"""FR-U-02/03/04, NFR-08: real API/PostgreSQL; mail is a test fixture only."""

import json
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import Table, func, inspect, select, text

from app.config import Settings
from app.db import challenges, limits, metadata, sessions, users
from app.main import create_app
from app.security import digest, passwords
from tests.conftest import ORIGIN, PASSWORD, Harness


def test_h01_unverified_signup_has_no_account_or_session(harness: Harness) -> None:
    h = harness
    h.signup()
    assert h.client.get("/api/v1/me").status_code == 401
    response = h.client.post(
        "/api/v1/auth/login",
        headers=h.csrf(),
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert response.status_code == 401
    with h.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(users)) == 0
        assert connection.scalar(select(func.count()).select_from(challenges)) == 1
    assert len(h.mail.messages) == 1


def count(h: Harness, table: Table) -> int:
    with h.engine.connect() as connection:
        return int(connection.execute(select(func.count()).select_from(table)).scalar_one())


def snapshot(h: Harness) -> str:
    with h.engine.connect() as connection:
        return repr(
            [
                list(
                    connection.execute(
                        select(table).order_by(*table.primary_key.columns)
                    ).mappings()
                )
                for table in metadata.sorted_tables
            ]
        )


@pytest.mark.parametrize(
    "email,password",
    [
        ("bad-address", PASSWORD),
        ("person@example.com", "a" * 14),
        ("person@example.com", "a" * 129),
        ("person@example.com", 123456789),
        ("x" * 321, PASSWORD),
    ],
)
def test_h02_invalid_input_not_reflected_or_written(
    harness: Harness, email: str, password: str
) -> None:
    h = harness
    headers = h.csrf()
    before = snapshot(h)
    response = h.client.post(
        "/api/v1/auth/signup", headers=headers, json={"email": email, "password": password}
    )
    assert response.status_code == 422
    assert str(password) not in response.text
    assert email not in response.text
    assert snapshot(h) == before
    assert not h.mail.messages


@pytest.mark.parametrize("password", [" " * 15, "한" * 128])
def test_h02_unicode_spaces_password_boundary(harness: Harness, password: str) -> None:
    harness.account(password=password)
    assert harness.login(password=password).status_code == 200
    assert harness.login(password=password + " ").status_code != 200


def test_h02_email_case_spaces_only_no_dot_plus_folding(harness: Harness) -> None:
    h = harness
    h.account(" Person.Name+tag@example.com ")
    assert h.client.get("/api/v1/me").json()["email"] == "person.name+tag@example.com"
    assert h.login("PERSON.NAME+TAG@example.com").status_code == 200
    h.account("personname@example.com")
    assert count(h, users) == 2


def test_h03_consume_once_and_rotate_session(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    original = h.client.cookies.get(h.settings.cookie_name)
    value = h.mail.messages[-1][1]
    result = h.verify(challenge, value)
    assert result.status_code == 201
    assert h.client.cookies.get(h.settings.cookie_name) != original
    assert h.client.get("/api/v1/me").json()["id"] == result.json()["id"]
    assert h.verify(challenge, value).status_code == 400
    assert count(h, users) == 1


@pytest.mark.parametrize("offset,expected", [(599.999, 201), (600, 400), (600.001, 400)])
def test_h04_exact_code_expiry(harness: Harness, offset: float, expected: int) -> None:
    h = harness
    challenge = h.signup()
    value = h.mail.messages[-1][1]
    h.clock.now += timedelta(seconds=offset)
    assert h.verify(challenge, value).status_code == expected
    assert count(h, users) == (1 if expected == 201 else 0)


def test_h05_wrong_attempt_limit(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    good = h.mail.messages[-1][1]
    bad = f"{(int(good) + 1) % 1_000_000:06d}"
    for _ in range(4):
        assert h.verify(challenge, bad).status_code == 400
    with h.engine.connect() as connection:
        assert connection.scalar(select(challenges.c.attempts)) == 4
    assert h.verify(challenge, bad).status_code == 400
    assert h.verify(challenge, good).status_code == 400
    assert count(h, users) == 0


def concurrent_verify(h: Harness, pairs: list[tuple[str, str]]) -> list[int]:
    clients = [h.new_client() for _ in pairs]
    headers = [h.csrf(client) for client in clients]
    barrier = Barrier(len(pairs))

    def run(index: int) -> int:
        challenge, value = pairs[index]
        barrier.wait(timeout=15)
        return int(
            clients[index]
            .post(
                "/api/v1/auth/verify",
                headers=headers[index],
                json={"challenge_id": challenge, "code": value},
            )
            .status_code
        )

    try:
        with ThreadPoolExecutor(max_workers=len(pairs)) as pool:
            return list(pool.map(run, range(len(pairs))))
    finally:
        for client in clients:
            client.close()


def test_h05_concurrent_wrong_codes_cannot_exceed_limit(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    good = h.mail.messages[-1][1]
    bad = f"{(int(good) + 1) % 1_000_000:06d}"
    assert concurrent_verify(h, [(challenge, bad)] * 6) == [400] * 6
    with h.engine.connect() as connection:
        assert connection.scalar(select(challenges.c.attempts)) == 5
    assert h.verify(challenge, good).status_code == 400


@pytest.mark.parametrize("same_challenge", [True, False])
def test_h06_concurrent_code_and_email_consumption(harness: Harness, same_challenge: bool) -> None:
    h = harness
    first = h.signup()
    first_code = h.mail.messages[-1][1]
    second = first if same_challenge else h.signup(password="다른 가상 비밀번호 1234567")
    second_code = first_code if same_challenge else h.mail.messages[-1][1]
    assert sorted(concurrent_verify(h, [(first, first_code), (second, second_code)])) == [201, 400]
    assert count(h, users) == 1
    assert concurrent_verify(h, [(first, first_code), (second, second_code)]) == [400, 400]


def test_h07_pre_registration_cannot_steal_legitimate_password(harness: Harness) -> None:
    h = harness
    attacker = "공격자 가상 비밀번호 123456789"
    h.signup(password=attacker)
    own = h.signup()
    assert h.verify(own).status_code == 201
    assert h.login(password=attacker).status_code == 401
    assert h.login().status_code == 200


def test_h08_existing_email_generic_signup_and_no_overwrite(harness: Harness) -> None:
    h = harness
    own_id = h.account()
    old_cookie = h.client.cookies.get(h.settings.cookie_name)
    challenge = h.signup(password="덮어쓰기 시도 비밀번호 123456789")
    response = h.verify(challenge)
    assert response.status_code == 400
    assert h.client.cookies.get(h.settings.cookie_name) == old_cookie
    assert h.client.get("/api/v1/me").json()["id"] == own_id
    assert h.login().status_code == 200
    assert count(h, users) == 1


def test_h08_other_challenge_code_rejected(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = harness
    values = iter(["123456", "654321"])
    monkeypatch.setattr("app.main.code", lambda: next(values))
    first = h.signup()
    second = h.signup()
    assert h.verify(first, "654321").status_code == 400
    assert h.verify(second, "123456").status_code == 400
    assert count(h, users) == 0


def test_h09_resend_exact_boundary_replaces_code(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = harness
    values = iter(["123456", "654321"])
    monkeypatch.setattr("app.main.code", lambda: next(values))
    challenge = h.signup()
    h.clock.now += timedelta(seconds=59)
    response = h.client.post(
        "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
    )
    assert response.status_code == 429 and response.headers["Retry-After"] == "1"
    assert len(h.mail.messages) == 1
    h.clock.now += timedelta(seconds=1)
    assert (
        h.client.post(
            "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
        ).status_code
        == 202
    )
    assert h.verify(challenge, "123456").status_code == 400
    assert h.verify(challenge, "654321").status_code == 201


@pytest.mark.parametrize("stuck", [False, True])
def test_h09_resend_cannot_reissue_immediately_previous_value(
    harness: Harness, monkeypatch: pytest.MonkeyPatch, stuck: bool
) -> None:
    h = harness
    challenge = h.signup()
    previous = h.mail.messages[-1][1]
    different = str((int(previous) + 1) % 1_000_000).zfill(6)
    values = iter([previous, different])
    monkeypatch.setattr("app.main.code", lambda: previous if stuck else next(values))
    h.clock.now += timedelta(seconds=60)
    result = h.client.post(
        "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
    )
    assert result.status_code == (503 if stuck else 202)
    assert h.verify(challenge, previous).status_code == 400
    if not stuck:
        assert h.verify(challenge, different).status_code == 201


def test_h10_mail_failure_invalidates_old_code_and_retry(harness: Harness) -> None:
    h = harness
    h.mail.fail = True
    response = h.client.post(
        "/api/v1/auth/signup",
        headers=h.csrf(),
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert response.status_code == 503
    with h.engine.connect() as connection:
        assert connection.scalar(select(challenges.c.code_hash)) is None
    assert count(h, users) == 0
    h.mail.fail = False
    challenge = h.signup()
    old = h.mail.messages[-1][1]
    h.clock.now += timedelta(seconds=60)
    h.mail.fail = True
    assert (
        h.client.post(
            "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
        ).status_code
        == 503
    )
    assert h.verify(challenge, old).status_code == 400
    h.mail.fail = False
    h.clock.now += timedelta(seconds=60)
    assert (
        h.client.post(
            "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
        ).status_code
        == 202
    )
    assert h.verify(challenge).status_code == 201


def test_h10_concurrent_resend_sends_once(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    h.clock.now += timedelta(seconds=60)
    clients = [h.new_client(), h.new_client()]
    headers = [h.csrf(c) for c in clients]
    barrier = Barrier(2)

    def run(i: int) -> int:
        barrier.wait(timeout=15)
        return int(
            clients[i]
            .post("/api/v1/auth/resend", headers=headers[i], json={"challenge_id": challenge})
            .status_code
        )

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(run, range(2))) == [202, 429]
        assert len(h.mail.messages) == 2
    finally:
        for client in clients:
            client.close()


def test_h11_email_quota_concurrent_and_restarted(harness: Harness) -> None:
    h = harness
    clients = [h.new_client(peer=f"peer-{i}") for i in range(6)]
    headers = [h.csrf(c) for c in clients]
    barrier = Barrier(6)

    def run(i: int) -> int:
        barrier.wait(timeout=15)
        return int(
            clients[i]
            .post(
                "/api/v1/auth/signup",
                headers=headers[i],
                json={"email": "person@example.com", "password": PASSWORD},
            )
            .status_code
        )

    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            assert sorted(pool.map(run, range(6))) == [202] * 5 + [429]
        with h.new_client(peer="fresh-peer") as restarted:
            response = restarted.post(
                "/api/v1/auth/signup",
                headers=h.csrf(restarted),
                json={"email": "PERSON@example.com", "password": PASSWORD},
            )
            assert response.status_code == 429
            h.clock.now += timedelta(hours=1)
            assert (
                restarted.post(
                    "/api/v1/auth/signup",
                    headers=h.csrf(restarted),
                    json={"email": "person@example.com", "password": PASSWORD},
                ).status_code
                == 202
            )
        assert len(h.mail.messages) == 6
    finally:
        for client in clients:
            client.close()


def test_h11_ip_quota_ignores_spoofed_forwarded_headers(harness: Harness) -> None:
    h = harness
    for i in range(21):
        response = h.client.post(
            "/api/v1/auth/signup",
            headers={**h.csrf(), "X-Forwarded-For": f"192.0.2.{i}", "Forwarded": f"for={i}"},
            json={"email": f"person{i}@example.com", "password": PASSWORD},
        )
        assert response.status_code == (202 if i < 20 else 429)
    assert len(h.mail.messages) == 20


def test_h11_combined_signup_resend_email_quota(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    for i in range(5):
        h.clock.now += timedelta(seconds=60)
        response = h.client.post(
            "/api/v1/auth/resend", headers=h.csrf(), json={"challenge_id": challenge}
        )
        assert response.status_code == (202 if i < 4 else 429)
    assert len(h.mail.messages) == 5


def test_h11_login_failures_email_ip_restart_quota(harness: Harness) -> None:
    h = harness
    for i in range(11):
        assert h.login().status_code == (401 if i < 10 else 429)
    with h.new_client(peer="other-peer") as restarted:
        assert (
            restarted.post(
                "/api/v1/auth/login",
                headers=h.csrf(restarted),
                json={"email": "PERSON@example.com", "password": PASSWORD},
            ).status_code
            == 429
        )
    for i in range(21):
        response = h.login(email=f"unknown{i}@example.com")
        assert response.status_code == (401 if i < 20 else 429)
    h.clock.now += timedelta(minutes=15)
    assert h.login().status_code == 401


def test_h12_generic_failure_and_same_hash_verify_path(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = harness
    h.account()
    calls: list[str] = []
    original = passwords.verify

    def verify(value: str, hashed: str) -> bool:
        calls.append(hashed)
        return original(value, hashed)

    monkeypatch.setattr(passwords, "verify", verify)
    known = h.login(password="잘못된 가상 비밀번호 12345")
    unknown = h.login(email="missing@example.com")
    assert known.status_code == unknown.status_code == 401
    assert known.json() == unknown.json()
    assert len(calls) == 2 and all(value.startswith("$argon2id$") for value in calls)
    assert h.login().status_code == 200
    assert set(h.login().json()) == {"id", "email", "csrf_token"}


def test_h11_concurrent_login_failures_cannot_exceed_email_quota(harness: Harness) -> None:
    h = harness
    for _ in range(8):
        assert h.login().status_code == 401
    clients = [h.new_client(peer=f"login-peer-{i}") for i in range(5)]
    headers = [h.csrf(c) for c in clients]
    barrier = Barrier(5)

    def run(i: int) -> int:
        barrier.wait(timeout=15)
        return int(
            clients[i]
            .post(
                "/api/v1/auth/login",
                headers=headers[i],
                json={"email": "person@example.com", "password": PASSWORD},
            )
            .status_code
        )

    try:
        with ThreadPoolExecutor(max_workers=5) as pool:
            assert sorted(pool.map(run, range(5))) == [401, 401, 429, 429, 429]
    finally:
        for client in clients:
            client.close()


def test_h13_fixation_and_old_csrf_not_accepted(harness: Harness) -> None:
    h = harness
    h.account()
    injected = secrets.token_urlsafe(32)
    h.client.cookies.clear()
    h.client.cookies.set(h.settings.cookie_name, injected, domain="localhost.local", path="/")
    headers = h.csrf()
    anonymous = h.client.cookies.get(h.settings.cookie_name)
    assert anonymous != injected
    login = h.client.post(
        "/api/v1/auth/login",
        headers=headers,
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert login.status_code == 200
    assert h.client.cookies.get(h.settings.cookie_name) not in {anonymous, injected}
    assert login.json()["csrf_token"] != headers["X-CSRF-Token"]
    assert h.client.post("/api/v1/auth/logout", headers=headers).status_code == 403
    with h.new_client() as stolen:
        stolen.cookies.set(h.settings.cookie_name, anonymous)
        assert stolen.get("/api/v1/me").status_code == 401


def test_h14_me_owner_and_tampered_cookie(harness: Harness) -> None:
    h = harness
    first_id = h.account()
    first_cookie = h.client.cookies.get(h.settings.cookie_name)
    with h.new_client() as other:
        original_client = h.client
        try:
            h.client = other
            second_id = h.account("other@example.com")
        finally:
            h.client = original_client
        assert first_id != second_id
        assert other.get(f"/api/v1/me?user_id={first_id}").json()["id"] == second_id
        assert h.client.get(f"/api/v1/me?user_id={second_id}").json()["id"] == first_id
        other.cookies.clear()
        other.cookies.set(h.settings.cookie_name, first_cookie, domain="localhost.local", path="/")
        assert other.get(f"/api/v1/me?user_id={second_id}").json()["id"] == first_id
        other.cookies.clear()
        other.cookies.set(h.settings.cookie_name, secrets.token_urlsafe(32))
        assert other.get("/api/v1/me").status_code == 401


@pytest.mark.parametrize(
    "path,payload",
    [
        ("signup", {"email": "new@example.com", "password": PASSWORD}),
        ("verify", {"challenge_id": "x" * 43, "code": "123456"}),
        ("resend", {"challenge_id": "x" * 43}),
        ("login", {"email": "person@example.com", "password": PASSWORD}),
        ("logout", {}),
    ],
)
@pytest.mark.parametrize("authenticated", [False, True])
def test_h15_each_post_checks_origin_session_csrf_without_mutation(
    harness: Harness, path: str, payload: dict[str, str], authenticated: bool
) -> None:
    h = harness
    if authenticated:
        h.account()
    headers = h.csrf()
    before = snapshot(h)
    mail_count = len(h.mail.messages)
    for bad in [
        {},
        {"Origin": ORIGIN},
        {"X-CSRF-Token": headers["X-CSRF-Token"]},
        {**headers, "X-CSRF-Token": "forged"},
        {**headers, "Origin": ORIGIN + ".attacker.com"},
        {**headers, "Origin": "null"},
    ]:
        assert h.client.post(f"/api/v1/auth/{path}", headers=bad, json=payload).status_code == 403
        assert snapshot(h) == before
        assert len(h.mail.messages) == mail_count
    if path != "logout":
        with h.new_client() as missing:
            assert (
                missing.post(f"/api/v1/auth/{path}", headers=headers, json=payload).status_code
                == 403
            )
            missing.cookies.set(h.settings.cookie_name, "z" * 43)
            assert (
                missing.post(f"/api/v1/auth/{path}", headers=headers, json=payload).status_code
                == 403
            )
        assert snapshot(h) == before
        h.clock.now += timedelta(hours=8 if authenticated else 10 / 60)
        expired_before = snapshot(h)
        assert (
            h.client.post(f"/api/v1/auth/{path}", headers=headers, json=payload).status_code == 403
        )
        assert snapshot(h) == expired_before
        assert len(h.mail.messages) == mail_count


def test_h15_non_ascii_csrf_is_403_not_server_error(harness: Harness) -> None:
    h = harness
    h.csrf()
    before = snapshot(h)
    response = h.client.post(
        "/api/v1/auth/signup",
        headers=[(b"origin", ORIGIN.encode()), (b"x-csrf-token", b"\xe9" * 64)],
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert response.status_code == 403
    assert snapshot(h) == before


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:5173.attacker.com",
        "http://localhost:51730",
        "http://localhost:5173/",
        "https://localhost:5173",
        "null",
    ],
)
def test_h16_origin_exact_match(harness: Harness, origin: str) -> None:
    h = harness
    response = h.client.post(
        "/api/v1/auth/signup",
        headers={**h.csrf(), "Origin": origin},
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert response.status_code == 403
    assert count(h, challenges) == 0 and not h.mail.messages


def test_h17_logout_db_revocation_restart_and_expired_cleanup(harness: Harness) -> None:
    h = harness
    h.account()
    raw = h.client.cookies.get(h.settings.cookie_name)
    response = h.client.post("/api/v1/auth/logout", headers=h.csrf())
    assert response.status_code == 204
    assert "Max-Age=0" in response.headers["Set-Cookie"]
    with h.engine.connect() as connection:
        assert (
            connection.scalar(
                select(sessions.c.revoked_at).where(sessions.c.token_hash == digest(raw))
            )
            is not None
        )
    with h.new_client() as restarted:
        restarted.cookies.set(h.settings.cookie_name, raw)
        assert restarted.get("/api/v1/me").status_code == 401
        before = snapshot(h)
        assert (
            restarted.post("/api/v1/auth/logout", headers={"Origin": ORIGIN + ".evil"}).status_code
            == 403
        )
        assert restarted.post("/api/v1/auth/logout", headers={"Origin": ORIGIN}).status_code == 204
        assert snapshot(h) == before
    h.login()
    h.clock.now += timedelta(minutes=30)
    before = snapshot(h)
    assert h.client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN}).status_code == 204
    assert snapshot(h) == before
    assert h.client.get("/api/v1/auth/logout").status_code == 405


@pytest.mark.parametrize("offset,expected", [(1799.999, 200), (1800, 401), (1800.001, 401)])
def test_h18_idle_expiry(harness: Harness, offset: float, expected: int) -> None:
    h = harness
    h.account()
    h.clock.now += timedelta(seconds=offset)
    assert h.client.get("/api/v1/me").status_code == expected


def test_h18_absolute_expiry_not_extended_by_me(harness: Harness) -> None:
    h = harness
    h.account()
    start = h.clock.now
    raw = h.client.cookies.get(h.settings.cookie_name)
    for i in range(1, 17):
        h.clock.now = start + timedelta(minutes=29 * i)
        assert h.client.get("/api/v1/me").status_code == 200
    h.clock.now = start + timedelta(hours=8)
    assert h.client.get("/api/v1/me").status_code == 401
    with h.engine.connect() as connection:
        assert connection.scalar(
            select(sessions.c.expires_at).where(sessions.c.token_hash == digest(raw))
        ) == start + timedelta(hours=8)


def test_h18_expired_anonymous_post_and_cleanup(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    headers = h.csrf()
    h.clock.now += timedelta(minutes=10)
    before = snapshot(h)
    assert (
        h.client.post(
            "/api/v1/auth/verify",
            headers=headers,
            json={"challenge_id": challenge, "code": h.mail.messages[-1][1]},
        ).status_code
        == 403
    )
    assert snapshot(h) == before
    assert count(h, users) == 0
    h.csrf()
    assert count(h, challenges) == 0 and count(h, limits) == 3
    h.clock.now += timedelta(hours=1)
    h.csrf()
    assert count(h, limits) == 1  # New anonymous session uses the current minute quota.


def test_h11_anonymous_creation_is_bounded_not_reset_by_new_cookie(harness: Harness) -> None:
    h = harness
    for _ in range(100):
        h.client.cookies.clear()
        assert h.client.get("/api/v1/auth/csrf").status_code == 200
    h.client.cookies.clear()
    before = snapshot(h)
    result = h.client.get("/api/v1/auth/csrf")
    assert result.status_code == 429 and result.headers["Retry-After"] == "60"
    assert snapshot(h) == before
    assert count(h, sessions) == 100
    h.clock.now += timedelta(minutes=1)
    assert h.client.get("/api/v1/auth/csrf").status_code == 200


@pytest.mark.parametrize("missing", ["security_key", "smtp_username", "smtp_password"])
def test_h19_production_requires_security_and_mail(harness: Harness, missing: str) -> None:
    values = {
        "environment": "production",
        "database_url": harness.settings.database_url,
        "security_key": secrets.token_urlsafe(32),
        "origin": "https://bodyguard.example.com",
        "smtp_username": "sender@example.com",
        "smtp_password": secrets.token_urlsafe(32),
    }
    values.pop(missing)
    # Do not use test fixture environment as implicit production config.
    with pytest.MonkeyPatch.context() as patch:
        patch.delenv("BODYGUARD_SECURITY_KEY", raising=False)
        with pytest.raises(ValidationError):
            Settings.model_validate(values)


def test_h19_no_test_provider_or_environment_launch(harness: Harness) -> None:
    prod = Settings(
        environment="production",
        database_url=harness.settings.database_url,
        security_key=secrets.token_urlsafe(32),
        origin="https://bodyguard.example.com",
        smtp_username="sender@example.com",
        smtp_password=secrets.token_urlsafe(32),
    )
    with pytest.raises(RuntimeError, match="Test dependencies"):
        create_app(prod, harness.engine, harness.mail, harness.clock)
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("BODYGUARD_ENVIRONMENT", "test")
        with pytest.raises(RuntimeError, match="Invalid BODYGUARD configuration"):
            Settings.from_environment()


@pytest.mark.parametrize("blank", [False, True])
def test_h19_development_mail_missing_never_succeeds(harness: Harness, blank: bool) -> None:
    dev = harness.settings.model_copy(update={"environment": "development"})
    if blank:
        dev = dev.model_copy(
            update={"smtp_username": SecretStr(""), "smtp_password": SecretStr("")}
        )
    with TestClient(create_app(dev, harness.engine), base_url="http://localhost") as client:
        headers = {
            "Origin": ORIGIN,
            "X-CSRF-Token": client.get("/api/v1/auth/csrf").json()["csrf_token"],
        }
        assert (
            client.post(
                "/api/v1/auth/signup",
                headers=headers,
                json={"email": "person@example.com", "password": PASSWORD},
            ).status_code
            == 503
        )
    assert count(harness, users) == 0


def test_h20_cookie_json_db_logs_schema_are_safe(
    harness: Harness, caplog: pytest.LogCaptureFixture
) -> None:
    h = harness
    csrf = h.client.get("/api/v1/auth/csrf")
    cookie = csrf.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Domain=" not in cookie
    assert csrf.headers["Cache-Control"] == "no-store"
    challenge = h.signup()
    raw = h.client.cookies.get(h.settings.cookie_name)
    value = h.mail.messages[-1][1]
    with h.engine.connect() as connection:
        stored = connection.execute(select(challenges)).mappings().one()
        assert stored["code_hash"] != value and len(stored["code_hash"]) == 64
        assert stored["password_hash"].startswith("$argon2id$")
        assert PASSWORD not in repr(stored) and raw not in repr(stored)
    invalid = h.client.post(
        "/api/v1/auth/verify",
        headers=h.csrf(),
        json={
            "challenge_id": challenge,
            "code": value + "EXTRA_PRIVATE_VALUE",
        },
    )
    assert invalid.status_code == 422
    response = h.verify(challenge, value)
    assert response.status_code == 201
    with h.engine.connect() as connection:
        rows = repr(
            [list(connection.execute(select(table)).mappings()) for table in metadata.sorted_tables]
        )
        hashed = connection.scalar(select(users.c.password_hash))
        assert isinstance(hashed, str)
        assert hashed.startswith("$argon2id$") and passwords.verify(PASSWORD, hashed)
    app = h.client.app
    assert isinstance(app, FastAPI)
    combined = rows + json.dumps(app.openapi()) + caplog.text + invalid.text + response.text
    for sensitive in [
        PASSWORD,
        value + "EXTRA_PRIVATE_VALUE",
        raw,
        h.settings.security_key.get_secret_value(),
    ]:
        assert sensitive not in combined
    assert not any(
        "landmark" in column["name"] or "coordinate" in column["name"]
        for table in inspect(h.engine).get_table_names()
        for column in inspect(h.engine).get_columns(table)
    )
    prod = Settings(
        environment="production",
        database_url=h.settings.database_url,
        security_key=secrets.token_urlsafe(32),
        origin="https://bodyguard.example.com",
        smtp_username="sender@example.com",
        smtp_password=secrets.token_urlsafe(32),
    )
    with TestClient(create_app(prod, h.engine), base_url=prod.origin) as client:
        result = client.get("/api/v1/auth/csrf")
        assert result.status_code == 200
        assert "__Host-bodyguard_session=" in result.headers["Set-Cookie"]
        assert "Secure" in result.headers["Set-Cookie"]
        assert client.get("/openapi.json").status_code == 404


def test_h21_migrated_constraints_and_restart(harness: Harness) -> None:
    h = harness
    assert set(inspect(h.engine).get_table_names()) == {
        "alembic_version",
        "users",
        "signup_challenges",
        "sessions",
        "auth_limits",
        "password_resets",
        "google_flows",
        "stretch_records",
        "account_withdrawals",
    }
    with h.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0005_account_withdrawal"
        )
    user_id = h.account()
    cookie = h.client.cookies.get(h.settings.cookie_name)
    with h.new_client() as restarted:
        restarted.cookies.set(h.settings.cookie_name, cookie)
        assert restarted.get("/api/v1/me").json()["id"] == user_id
        assert restarted.post("/api/v1/auth/logout", headers=h.csrf(restarted)).status_code == 204
    assert h.client.get("/api/v1/me").status_code == 401
