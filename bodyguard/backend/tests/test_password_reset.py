"""FR-U-03/NFR-08: real API/PostgreSQL recovery; delivery/clock are test-only."""

import secrets
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import uvicorn
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event, insert, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db import resets, sessions, users
from app.main import create_app
from app.security import digest, passwords
from tests.conftest import ORIGIN, PASSWORD, Harness
from tests.test_auth import count, snapshot

NEW_PASSWORD = "새로운 가상 비밀번호 56789"
FORGOT = "/api/v1/auth/password/forgot"
RESET = "/api/v1/auth/password/reset"


def request_link(h: Harness, email: str = "person@example.com") -> str:
    response = h.client.post(FORGOT, headers=h.csrf(), json={"email": email})
    assert response.status_code == 202
    address, link = h.mail.messages[-1]
    assert address == email.lower().strip()
    parsed = urlsplit(link)
    assert parsed.scheme + "://" + parsed.netloc == ORIGIN
    assert parsed.path == "/password/reset" and not parsed.query
    return parse_qs(parsed.fragment)["token"][0]


def reset(h: Harness, value: str, password: str = NEW_PASSWORD) -> httpx.Response:
    return h.client.post(RESET, headers=h.csrf(), json={"token": value, "password": password})


def test_r01_unknown_email_request_is_generic(harness: Harness) -> None:
    h = harness
    response = h.client.post(
        "/api/v1/auth/password/forgot",
        headers=h.csrf(),
        json={"email": "unknown@example.com"},
    )
    assert response.status_code == 202
    assert not h.mail.messages


def test_r01_existing_unknown_same_response_and_no_account_change(harness: Harness) -> None:
    h = harness
    h.account()
    known = h.client.post(FORGOT, headers=h.csrf(), json={"email": "PERSON@example.com "})
    before = len(h.mail.messages)
    unknown = h.client.post(FORGOT, headers=h.csrf(), json={"email": "other@example.com"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    assert len(h.mail.messages) == before
    assert h.client.get("/api/v1/me").status_code == 200 and h.login().status_code == 200
    with h.engine.connect() as c:
        row = c.execute(select(resets)).mappings().one()
        raw = parse_qs(urlsplit(h.mail.messages[-1][1]).fragment)["token"][0]
        assert row["token_hash"] == digest(raw) and raw not in repr(row)
        assert row["expires_at"] - row["created_at"] == timedelta(minutes=30)


def test_r01_actual_http_ack_precedes_blocked_delivery(harness: Harness) -> None:
    h = harness
    h.account()
    entered, release = threading.Event(), threading.Event()

    def delayed_mail(email: str, link: str) -> None:
        entered.set()
        assert release.wait(5), "test delivery was not released"

    # Owned ephemeral listener; no external mail or existing server reuse.
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
        server = uvicorn.Server(
            uvicorn.Config(
                create_app(h.settings, h.engine, clock=h.clock, reset_mail=delayed_mail),
                access_log=False,
                proxy_headers=False,
                log_level="warning",
            )
        )
        worker = threading.Thread(target=server.run, kwargs={"sockets": [listener]})
        worker.start()
        try:
            for _ in range(100):
                if server.started:
                    break
                assert worker.is_alive()
                time.sleep(0.01)
            assert server.started
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=2) as client:
                csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
                response = client.post(
                    FORGOT,
                    headers={"Origin": ORIGIN, "X-CSRF-Token": csrf},
                    json={"email": "person@example.com"},
                )
                assert response.status_code == 202 and not release.is_set()
                assert entered.wait(2)
        finally:
            release.set()
            server.should_exit = True
            worker.join(timeout=5)
            assert not worker.is_alive()


@pytest.mark.parametrize("offset,status", [(1799.999, 204), (1800, 400), (1800.001, 400)])
def test_r02_expiry_boundary(harness: Harness, offset: float, status: int) -> None:
    h = harness
    h.account()
    value = request_link(h)
    h.clock.now += timedelta(seconds=offset)
    assert reset(h, value).status_code == status


def test_r02_latest_single_use_and_get_does_not_consume(harness: Harness) -> None:
    h = harness
    h.account()
    first, latest = request_link(h), request_link(h)
    assert first != latest
    assert reset(h, first).status_code == 400
    assert h.client.get(RESET).status_code == 405
    assert reset(h, latest, "short").status_code == 422
    assert reset(h, latest).status_code == 204
    assert reset(h, latest).status_code == 400


def test_r02_concurrent_consumption_exactly_once(harness: Harness) -> None:
    h = harness
    h.account()
    value = request_link(h)
    clients = [h.new_client(peer=f"reset-{index}") for index in range(2)]
    headers = [h.csrf(client) for client in clients]
    barrier = threading.Barrier(2)

    def consume(index: int) -> int:
        barrier.wait(timeout=3)
        return (
            clients[index]
            .post(RESET, headers=headers[index], json={"token": value, "password": NEW_PASSWORD})
            .status_code
        )

    try:
        with ThreadPoolExecutor(2) as pool:
            assert sorted(pool.map(consume, range(2))) == [204, 400]
        with h.engine.connect() as c:
            assert c.scalar(select(users.c.credentials_version)) == 1
    finally:
        for client in clients:
            client.close()


def test_r03_all_old_sessions_csrf_invalid_other_user_unchanged(harness: Harness) -> None:
    h = harness
    owner = h.account()
    old_cookie = h.client.cookies.get(h.settings.cookie_name)
    old_headers = h.csrf()
    value = request_link(h)
    with h.new_client() as old, h.new_client() as other:
        old.cookies.set(h.settings.cookie_name, old_cookie)
        challenge = other.post(
            "/api/v1/auth/signup",
            headers=h.csrf(other),
            json={
                "email": "other@example.com",
                "password": PASSWORD,
            },
        ).json()["challenge_id"]
        assert (
            other.post(
                "/api/v1/auth/verify",
                headers=h.csrf(other),
                json={
                    "challenge_id": challenge,
                    "code": h.mail.messages[-1][1],
                },
            ).status_code
            == 201
        )
        assert reset(h, value).status_code == 204
        assert h.client.get("/api/v1/me").status_code == old.get("/api/v1/me").status_code == 401
        assert (
            old.post(
                FORGOT,
                headers=old_headers,
                json={
                    "email": "person@example.com",
                },
            ).status_code
            == 403
        )
        assert other.get("/api/v1/me").json()["email"] == "other@example.com"
    assert h.login().status_code == 401
    assert h.login(password=NEW_PASSWORD).status_code == 200
    with h.engine.connect() as c:
        stored = c.scalar(select(users.c.password_hash).where(users.c.id == owner))
        assert stored.startswith("$argon2id$") and passwords.verify(NEW_PASSWORD, stored)


def test_r03_login_started_before_reset_cannot_leave_valid_session(
    harness: Harness,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = harness
    h.account()
    value = request_link(h)
    entered, release = threading.Event(), threading.Event()
    original = passwords.verify

    def delayed_verify(password: str, hashed: str) -> bool:
        entered.set()
        assert release.wait(5)
        return original(password, hashed)

    with h.new_client() as login_client:
        headers = h.csrf(login_client)
        monkeypatch.setattr(passwords, "verify", delayed_verify)
        with ThreadPoolExecutor(1) as pool:
            future = pool.submit(
                login_client.post,
                "/api/v1/auth/login",
                headers=headers,
                json={"email": "person@example.com", "password": PASSWORD},
            )
            try:
                assert entered.wait(3)
                assert reset(h, value).status_code == 204
            finally:
                release.set()
            assert future.result(timeout=5).status_code == 200
        assert login_client.get("/api/v1/me").status_code == 401


@pytest.mark.parametrize("password", [" " * 15, "한" * 128])
def test_r03_same_password_policy(harness: Harness, password: str) -> None:
    h = harness
    h.account()
    assert reset(h, request_link(h), password).status_code == 204
    assert h.login(password=password).status_code == 200


@pytest.mark.parametrize(
    "path,body",
    [
        (FORGOT, {"email": "person@example.com"}),
        (RESET, {"token": "a" * 43, "password": NEW_PASSWORD}),
    ],
)
def test_r04_protect_before_body_and_no_state_mutation(
    harness: Harness,
    path: str,
    body: dict[str, str],
) -> None:
    h = harness
    headers = h.csrf()
    before = snapshot(h)
    for bad in ({}, {**headers, "Origin": ORIGIN + ".evil"}, {**headers, "X-CSRF-Token": "x" * 64}):
        assert h.client.post(path, headers=bad, json=body).status_code == 403
        assert snapshot(h) == before


def test_r04_delivery_failure_generic_and_token_revoked(harness: Harness) -> None:
    h = harness
    h.account()
    h.mail.fail = True
    known = h.client.post(FORGOT, headers=h.csrf(), json={"email": "person@example.com"})
    unknown = h.client.post(FORGOT, headers=h.csrf(), json={"email": "unknown@example.com"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    assert count(h, resets) == 0
    assert h.login().status_code == 200


def test_r04_reset_mail_fixture_cannot_launch_development(harness: Harness) -> None:
    h = harness
    dev = h.settings.model_copy(update={"environment": "development"})
    with pytest.raises(RuntimeError, match="Test dependencies"):
        create_app(dev, h.engine, reset_mail=h.mail)


def test_r04_host_header_cannot_control_link(harness: Harness) -> None:
    h = harness
    h.account()
    response = h.client.post(
        FORGOT,
        headers={
            **h.csrf(),
            "Host": "attacker.invalid",
        },
        json={"email": "person@example.com"},
    )
    assert response.status_code == 202
    assert h.mail.messages[-1][1].startswith(ORIGIN + "/password/reset#token=")


def test_r03_transaction_failure_does_not_change_password_or_consume_link(harness: Harness) -> None:
    h = harness
    h.account()
    raw = request_link(h)

    def fail_consume(*args: object) -> None:
        if str(args[2]).startswith("UPDATE password_resets SET used_at"):
            raise SQLAlchemyError("controlled test transaction failure")

    event.listen(h.engine, "before_cursor_execute", fail_consume)
    try:
        assert reset(h, raw).status_code == 503
    finally:
        event.remove(h.engine, "before_cursor_execute", fail_consume)
    with h.engine.connect() as c:
        row = c.execute(select(users)).mappings().one()
        assert row["credentials_version"] == 0 and passwords.verify(PASSWORD, row["password_hash"])
        assert c.scalar(select(resets.c.used_at)) is None
    assert reset(h, raw).status_code == 204


def test_r04_no_smtp_is_503_for_both_addresses(harness: Harness) -> None:
    h = harness
    h.account()
    dev = h.settings.model_copy(update={"environment": "development"})
    with TestClient(create_app(dev, h.engine), base_url="http://localhost") as client:
        results = [
            client.post(FORGOT, headers=h.csrf(client), json={"email": email})
            for email in ("person@example.com", "unknown@example.com")
        ]
        assert [response.status_code for response in results] == [503, 503]
        assert results[0].json() == results[1].json()


def test_r04_durable_shared_mail_and_reset_quotas(harness: Harness) -> None:
    h = harness
    h.account()  # one email request already consumed
    for _ in range(4):
        request_link(h)
    with h.new_client() as restarted:
        blocked = restarted.post(
            FORGOT, headers=h.csrf(restarted), json={"email": "person@example.com"}
        )
        assert blocked.status_code == 429 and blocked.headers["Retry-After"] == "3600"
    for _ in range(30):
        assert reset(h, "a" * 43).status_code == 400
    blocked = reset(h, "a" * 43)
    assert blocked.status_code == 429 and blocked.headers["Retry-After"] == "60"
    h.clock.now += timedelta(minutes=1)
    assert reset(h, "a" * 43).status_code == 400


@pytest.mark.parametrize(
    "raw,password",
    [
        ("private-invalid-token", NEW_PASSWORD),
        ("é" * 43, NEW_PASSWORD),
        (12345, NEW_PASSWORD),
        ("a" * 43, "private-short"),
        ("a" * 43, "x" * 129),
    ],
)
def test_r04_validation_never_reflects_secrets(
    harness: Harness,
    raw: str | int,
    password: str,
) -> None:
    h = harness
    response = h.client.post(RESET, headers=h.csrf(), json={"token": raw, "password": password})
    assert response.status_code == 422
    assert str(raw) not in response.text and password not in response.text


def test_r05_actual_migration_preserves_old_users_and_sessions(harness: Harness) -> None:
    h = harness
    user_id = h.account()
    original_cookie = h.client.cookies.get(h.settings.cookie_name)
    old_cookie = secrets.token_urlsafe(32)
    with h.new_client() as anonymous:
        h.csrf(anonymous)
    config = Config("alembic.ini")
    try:
        command.downgrade(config, "0001_accounts")  # dedicated test DB only
        with h.engine.begin() as c:
            assert (
                c.scalar(select(users.c.email).where(users.c.id == user_id)) == "person@example.com"
            )
            assert (
                c.scalar(
                    text("SELECT revoked_at FROM sessions WHERE token_hash = :hashed"),
                    {"hashed": digest(original_cookie)},
                )
                is not None
            )
            # A synthetic pre-existing v1 authenticated session on actual old SQL schema.
            c.execute(
                text(
                    "INSERT INTO sessions "
                    "(token_hash, user_id, created_at, last_seen_at, expires_at) "
                    "VALUES (:hashed, :user_id, :now, :now, :expiry)"
                ),
                {
                    "hashed": digest(old_cookie),
                    "user_id": user_id,
                    "now": h.clock.now,
                    "expiry": h.clock.now + timedelta(hours=1),
                },
            )
        h.client.cookies.clear()
        h.client.cookies.set(h.settings.cookie_name, old_cookie)
        command.upgrade(config, "head")
        assert h.client.cookies.get(h.settings.cookie_name) == old_cookie
        assert h.client.get("/api/v1/me").json()["id"] == user_id
        with h.engine.connect() as c:
            for row in c.execute(select(sessions)).mappings():
                assert row["credentials_version"] == (0 if row["user_id"] else None)
        with pytest.raises(IntegrityError), h.engine.begin() as c:
            c.execute(
                insert(sessions).values(
                    token_hash=digest(secrets.token_urlsafe(32)),
                    user_id=user_id,
                    credentials_version=None,
                    created_at=h.clock.now,
                    last_seen_at=h.clock.now,
                    expires_at=h.clock.now + timedelta(hours=1),
                )
            )
        with h.engine.connect() as c:
            assert (
                c.scalar(text("SELECT version_num FROM alembic_version")) == "0008_minute_summaries"
            )
    finally:
        command.upgrade(config, "head")
