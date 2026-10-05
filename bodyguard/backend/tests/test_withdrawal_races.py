"""FR-U-05/NFR-08: actual SQL locks, bounded conflict and explicit retry; synthetic users."""

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, event, insert, select

from app.db import challenges, limits, sessions, stretch_records, users, withdrawals
from app.security import digest, keyed, passwords, quota
from tests.conftest import PASSWORD, Harness
from tests.test_account_withdrawal import begin, confirm
from tests.test_password_reset import NEW_PASSWORD, request_link
from tests.test_records import payload


def other_session(h: Harness) -> TestClient:
    client = h.new_client(peer="second-owned-session")
    original = h.client
    try:
        h.client = client
        assert h.login(password=PASSWORD).status_code == 200
    finally:
        h.client = original
    return client


@pytest.mark.parametrize("operation", ["record", "reset", "cleanup", "signup-verify"])
def test_w13_opposing_sql_locks_preserve_then_explicit_retry(
    harness: Harness,
    operation: str,
) -> None:
    h = harness
    owner = h.account()
    second = other_session(h)
    headers = h.csrf(second)
    record = payload(h)
    reset_link = request_link(h) if operation == "reset" else None
    pending, pending_code = None, None
    anonymous = h.new_client(peer="independent-request")
    anon_headers = h.csrf(anonymous)
    if operation == "signup-verify":
        old = h.client
        try:
            h.client = anonymous
            pending = h.signup()
            pending_code = h.mail.messages[-1][1]
        finally:
            h.client = old
    challenge, code = begin(h)
    own_headers = h.csrf()
    if operation == "cleanup":
        with h.engine.begin() as c:
            c.execute(
                insert(sessions).values(
                    token_hash=digest("synthetic-expired-session"),
                    user_id=owner,
                    credentials_version=0,
                    created_at=h.clock.now - timedelta(hours=2),
                    last_seen_at=h.clock.now - timedelta(hours=2),
                    expires_at=h.clock.now - timedelta(hours=1),
                )
            )
    entered, release = threading.Event(), threading.Event()

    def after_sql(*args: object) -> None:
        statement = str(args[2])
        target = {
            "record": statement.startswith("INSERT INTO stretch_records"),
            "reset": statement.startswith("UPDATE users SET password_hash"),
            "cleanup": statement.startswith("DELETE FROM sessions"),
            "signup-verify": (
                statement.startswith("SELECT signup_challenges")
                and statement.endswith("FOR UPDATE")
            ),
        }[operation]
        if target and not entered.is_set():
            if operation == "cleanup":
                assert args[1].rowcount == 1
            entered.set()
            assert release.wait(5), "owned competing SQL transaction was not released"

    def competing() -> int:
        if operation == "record":
            return second.post("/api/v1/records/stretch", headers=headers, json=record).status_code
        if operation == "reset":
            return second.post(
                "/api/v1/auth/password/reset",
                headers=headers,
                json={"token": reset_link, "password": NEW_PASSWORD},
            ).status_code
        if operation == "signup-verify":
            return anonymous.post(
                "/api/v1/auth/verify",
                headers=anon_headers,
                json={"challenge_id": pending, "code": pending_code},
            ).status_code
        return anonymous.get("/api/v1/auth/csrf").status_code

    event.listen(h.engine, "after_cursor_execute", after_sql)
    try:
        with ThreadPoolExecutor(1) as pool:
            work = pool.submit(competing)
            try:
                assert entered.wait(3), operation
                result = h.client.post(
                    "/api/v1/me/delete/confirm",
                    headers=own_headers,
                    json={
                        "challenge_id": challenge,
                        "code": code,
                        "confirmation": "delete-my-account",
                    },
                )
                # No partial deletion, deadlock victim or silent success is accepted.
                assert result.status_code == 503, (operation, result.text)
                with h.engine.connect() as c:
                    assert c.scalar(select(users.c.id)) == owner
                    assert c.scalar(select(withdrawals.c.user_id)) == owner
            finally:
                release.set()
            assert (
                work.result(timeout=5)
                == {
                    "record": 201,
                    "reset": 204,
                    "cleanup": 200,
                    "signup-verify": 400,
                }[operation]
            )
    finally:
        event.remove(h.engine, "after_cursor_execute", after_sql)
        second.close()
        anonymous.close()
    if operation == "reset":
        assert h.client.get("/api/v1/me").status_code == 401
        assert h.login(password=NEW_PASSWORD).status_code == 200
        assert confirm(h, challenge, code).status_code == 400
        # Signup + reset + initial withdrawal + this fresh proof stay within the quota.
        challenge, code = begin(h)
    assert confirm(h, challenge, code).status_code == 204
    with h.engine.connect() as c:
        assert c.execute(select(users)).first() is None
        assert c.execute(select(stretch_records)).first() is None


def test_w13_concurrent_confirmation_never_deletes_twice(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, code = begin(h)
    headers = h.csrf()
    cookies = dict(h.client.cookies)
    barrier = threading.Barrier(2)

    def run(_: int) -> int:
        with h.new_client() as client:
            client.cookies.update(cookies)
            barrier.wait(timeout=3)
            return client.post(
                "/api/v1/me/delete/confirm",
                headers=headers,
                json={"challenge_id": challenge, "code": code, "confirmation": "delete-my-account"},
            ).status_code

    with ThreadPoolExecutor(2) as pool:
        statuses = list(pool.map(run, range(2)))
    assert statuses.count(204) == 1
    assert all(status in (204, 401, 403, 503) for status in statuses)
    with h.engine.connect() as c:
        assert c.execute(select(users)).first() is None
        assert c.execute(select(withdrawals)).first() is None


def test_w13_quota_recreated_after_actual_delete_between_snapshots(harness: Harness) -> None:
    h = harness
    k = keyed(h.settings.security_key.get_secret_value(), "mail-email", "person@example.com")
    with h.engine.begin() as c:
        c.execute(
            insert(limits).values(key_hash=k, count=2, expires_at=h.clock.now + timedelta(hours=1))
        )
    entered, release = threading.Event(), threading.Event()

    def before_select(*args: object) -> None:
        statement = str(args[2])
        if (
            statement.startswith("SELECT auth_limits")
            and "FOR UPDATE" in statement
            and not entered.is_set()
        ):
            entered.set()
            assert release.wait(3)

    def check() -> int:
        with h.engine.begin() as c:
            return quota(c, [(k, 5)], h.clock.now, timedelta(hours=1), consume=True)

    event.listen(h.engine, "before_cursor_execute", before_select)
    try:
        with ThreadPoolExecutor(1) as pool:
            work = pool.submit(check)
            try:
                assert entered.wait(3)
                with h.engine.begin() as c:
                    c.execute(delete(limits).where(limits.c.key_hash == k))
            finally:
                release.set()
            assert work.result(timeout=5) == 0
    finally:
        event.remove(h.engine, "before_cursor_execute", before_select)
    with h.engine.connect() as c:
        assert c.scalar(select(limits.c.count).where(limits.c.key_hash == k)) == 1


def test_w14_other_session_and_signup_locks_are_not_skipped(harness: Harness) -> None:
    h = harness
    owner = h.account()
    challenge, value = begin(h)
    # A direct real SQL lock represents an active second tab's signup resend transaction.
    with h.engine.begin() as blocker:
        blocker.execute(select(challenges).with_for_update()).all()
        assert confirm(h, challenge, value).status_code == 503
        assert blocker.scalar(select(users.c.id)) == owner
    assert confirm(h, challenge, value).status_code == 204


@pytest.mark.parametrize("existing_quota", [False, True])
def test_w15_login_in_flight_cannot_leave_an_authenticated_deleted_user(
    harness: Harness,
    monkeypatch: pytest.MonkeyPatch,
    existing_quota: bool,
) -> None:
    h = harness
    owner = h.account()
    if existing_quota:
        assert h.login().status_code == 200
    challenge, value = begin(h)
    headers = h.csrf()
    entered, release = threading.Event(), threading.Event()
    original = passwords.verify

    def held_verify(password: str, hashed: str) -> bool:
        entered.set()
        assert release.wait(5)
        return original(password, hashed)

    with h.new_client(peer="parallel-login") as login_client:
        login_headers = h.csrf(login_client)
        monkeypatch.setattr(passwords, "verify", held_verify)
        with ThreadPoolExecutor(1) as pool:
            work = pool.submit(
                login_client.post,
                "/api/v1/auth/login",
                headers=login_headers,
                json={"email": "person@example.com", "password": PASSWORD},
            )
            try:
                assert entered.wait(3)
                response = h.client.post(
                    "/api/v1/me/delete/confirm",
                    headers=headers,
                    json={
                        "challenge_id": challenge,
                        "code": value,
                        "confirmation": "delete-my-account",
                    },
                )
                assert response.status_code == (503 if existing_quota else 204)
                with h.engine.connect() as c:
                    assert c.scalar(select(users.c.id)) == (owner if existing_quota else None)
            finally:
                release.set()
            assert work.result(timeout=5).status_code == (200 if existing_quota else 503)
        if existing_quota:
            assert login_client.get("/api/v1/me").json()["id"] == owner
            assert confirm(h, challenge, value).status_code == 204
        assert login_client.get("/api/v1/me").status_code == 401
    with h.engine.connect() as c:
        assert c.execute(select(users)).first() is None


def test_w15_concurrent_wrong_codes_cannot_exceed_attempt_limit(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, good = begin(h)
    bad = f"{(int(good) + 1) % 1_000_000:06d}"
    headers = h.csrf()
    cookies = dict(h.client.cookies)
    barrier = threading.Barrier(6)

    def run(_: int) -> int:
        with h.new_client() as client:
            client.cookies.update(cookies)
            barrier.wait(timeout=5)
            return client.post(
                "/api/v1/me/delete/confirm",
                headers=headers,
                json={"challenge_id": challenge, "code": bad, "confirmation": "delete-my-account"},
            ).status_code

    with ThreadPoolExecutor(6) as pool:
        statuses = list(pool.map(run, range(6)))
    assert 400 in statuses and all(status in (400, 503) for status in statuses)
    with h.engine.connect() as c:
        attempts = c.scalar(select(withdrawals.c.attempts))
        assert 1 <= attempts <= 5
    for _ in range(5 - attempts):
        assert confirm(h, challenge, bad).status_code == 400
    assert confirm(h, challenge, good).status_code == 400
    assert h.client.get("/api/v1/me").status_code == 200
