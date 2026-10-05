"""FR-U-05/NFR-08: account withdrawal uses isolated real HTTP/SQL, synthetic email only."""

from datetime import timedelta
from email.message import EmailMessage

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx2 import Response
from pydantic import SecretStr
from sqlalchemy import delete, event, func, insert, inspect, select, text, update
from sqlalchemy.exc import SQLAlchemyError

from app.db import (
    challenges,
    google_flows,
    limits,
    resets,
    sessions,
    stretch_records,
    users,
    withdrawals,
)
from app.main import create_app, smtp_mail, utcnow
from app.security import digest, keyed
from tests.conftest import ORIGIN, Harness
from tests.test_auth import snapshot
from tests.test_password_reset import request_link, reset
from tests.test_records import payload


def begin(h: Harness) -> tuple[str, str]:
    response = h.client.post("/api/v1/me/delete/start", headers=h.csrf(), json={})
    assert response.status_code == 202, response.text
    challenge = str(response.json()["challenge_id"])
    return challenge, h.mail.messages[-1][1]


def confirm(h: Harness, challenge: str, code: str) -> Response:
    return h.client.post(
        "/api/v1/me/delete/confirm",
        headers=h.csrf(),
        json={
            "challenge_id": challenge,
            "code": code,
            "confirmation": "delete-my-account",
        },
    )


def test_w01_start_does_not_delete_and_explicit_confirmation_removes_owner(
    harness: Harness,
) -> None:
    h = harness
    owner = h.account()
    record = payload(h)
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=record).status_code == 201
    )
    challenge, code = begin(h)
    assert h.client.get("/api/v1/me").status_code == 200
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1
    assert confirm(h, challenge, code).status_code == 204
    assert h.client.get("/api/v1/me").status_code == 401
    with h.engine.begin() as connection:
        for table in (sessions, stretch_records):
            assert (
                connection.scalar(
                    select(func.count()).select_from(table).where(table.c.user_id == owner)
                )
                == 0
            )
        assert connection.scalar(select(func.count()).select_from(users)) == 0


def test_w02_wrong_code_keeps_account_and_record(harness: Harness) -> None:
    h = harness
    h.account()
    record = payload(h)
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=record).status_code == 201
    )
    challenge, code = begin(h)
    wrong = "000000" if code != "000000" else "999999"
    assert confirm(h, challenge, wrong).status_code == 400
    assert h.client.get("/api/v1/me").status_code == 200
    assert [row["id"] for row in h.client.get("/api/v1/records/stretch").json()["items"]] == [
        record["id"]
    ]


def test_w03_email_field_cannot_redirect_confirmation(harness: Harness) -> None:
    h = harness
    h.account()
    response = h.client.post(
        "/api/v1/me/delete/start", headers=h.csrf(), json={"email": "other@example.com"}
    )
    assert response.status_code == 422
    assert h.client.get("/api/v1/me").status_code == 200


@pytest.mark.parametrize("offset,status", [(599.999, 204), (600, 400), (600.001, 400), (-1, 400)])
def test_w04_expiry_and_clock_reversal(harness: Harness, offset: float, status: int) -> None:
    h = harness
    h.account()
    challenge, value = begin(h)
    h.clock.now += timedelta(seconds=offset)
    assert confirm(h, challenge, value).status_code == status
    assert h.client.get("/api/v1/me").status_code == (401 if status == 204 else 200)


def test_w04_five_wrong_attempts_and_latest_proof_only(harness: Harness) -> None:
    h = harness
    h.account()
    old, old_code = begin(h)
    challenge, good = begin(h)
    assert confirm(h, old, old_code).status_code == 400
    bad = f"{(int(good) + 1) % 1_000_000:06d}"
    for _ in range(5):
        assert confirm(h, challenge, bad).status_code == 400
    assert confirm(h, challenge, good).status_code == 400
    with h.engine.connect() as c:
        row = c.execute(select(withdrawals)).mappings().one()
        assert row["attempts"] == 5
        assert good not in repr(row) and challenge not in repr(row)
        assert row["challenge_hash"] == keyed(
            h.settings.security_key.get_secret_value(), "withdrawal-challenge", challenge
        )
    assert h.client.get("/api/v1/me").status_code == 200


def test_w05_new_session_cannot_consume_old_proof(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, value = begin(h)
    assert h.login().status_code == 200
    assert confirm(h, challenge, value).status_code == 400
    new, code = begin(h)
    assert confirm(h, new, code).status_code == 204


def test_w05_signup_code_not_a_withdrawal_proof(harness: Harness) -> None:
    h = harness
    challenge = h.signup()
    signup_code = h.mail.messages[-1][1]
    assert h.verify(challenge, signup_code).status_code == 201
    assert confirm(h, challenge, signup_code).status_code == 400
    assert h.client.get("/api/v1/me").status_code == 200


def test_w05_credentials_change_invalidates_withdrawal(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, value = begin(h)
    link = request_link(h)
    assert reset(h, link).status_code == 204
    assert h.login(password="새로운 가상 비밀번호 56789").status_code == 200
    assert confirm(h, challenge, value).status_code == 400


def test_w06_failed_mail_revokes_previous_and_consumes_quota(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, value = begin(h)
    h.mail.fail = True
    for _ in range(3):  # Signup + successful proof + three failed deliveries = five.
        result = h.client.post("/api/v1/me/delete/start", headers=h.csrf(), json={})
        assert result.status_code == 503
        assert "challenge_id" not in result.json()
    assert confirm(h, challenge, value).status_code == 400
    h.mail.fail = False
    blocked = h.client.post("/api/v1/me/delete/start", headers=h.csrf(), json={})
    assert blocked.status_code == 429 and blocked.headers["Retry-After"] == "3600"
    with h.engine.connect() as c:
        assert c.scalar(select(withdrawals.c.code_hash)) is None
        assert c.scalar(select(func.count()).select_from(users)) == 1


@pytest.mark.parametrize("suffix", ["start", "confirm"])
def test_w07_origin_csrf_guest_get_never_delete(harness: Harness, suffix: str) -> None:
    h = harness
    path = "/api/v1/me/delete/" + suffix
    body = (
        {}
        if suffix == "start"
        else {
            "challenge_id": "a" * 43,
            "code": "123456",
            "confirmation": "delete-my-account",
        }
    )
    assert h.client.post(path, headers=h.csrf(), json=body).status_code == 401
    h.account()
    headers = h.csrf()
    before = snapshot(h)
    for bad in ({}, {**headers, "Origin": ORIGIN + ".evil"}, {**headers, "X-CSRF-Token": "a" * 64}):
        assert h.client.post(path, headers=bad, json=body).status_code == 403
        assert snapshot(h) == before
    assert h.client.get(path).status_code == 405
    assert snapshot(h) == before


@pytest.mark.parametrize(
    "change",
    [
        {"code": "１２３４５６"},
        {"code": 123456},
        {"code": "12345"},
        {"confirmation": "yes"},
        {"user_id": "someone-else"},
        {"challenge_id": "private-invalid"},
    ],
)
def test_w07_invalid_payload_not_reflected_or_mutated(
    harness: Harness, change: dict[str, object]
) -> None:
    h = harness
    h.account()
    challenge, value = begin(h)
    headers = h.csrf()
    before = snapshot(h)
    result = h.client.post(
        "/api/v1/me/delete/confirm",
        headers=headers,
        json={
            "challenge_id": challenge,
            "code": value,
            "confirmation": "delete-my-account",
            **change,
        },
    )
    assert result.status_code == 422
    assert value not in result.text and "private-invalid" not in result.text
    assert snapshot(h) == before


def test_w08_other_account_cannot_consume_proof_and_survives(harness: Harness) -> None:
    h = harness
    owner = h.account()
    old_client = h.client
    with h.new_client() as other:
        try:
            h.client = other
            other_id = h.account("other@example.com")
            record = payload(h)
            assert (
                other.post("/api/v1/records/stretch", headers=h.csrf(), json=record).status_code
                == 201
            )
        finally:
            h.client = old_client
        challenge, value = begin(h)
        try:
            h.client = other
            assert confirm(h, challenge, value).status_code == 400
        finally:
            h.client = old_client
        assert confirm(h, challenge, value).status_code == 204
        assert other.get("/api/v1/me").json()["id"] == other_id
        assert other.get("/api/v1/records/stretch").json()["items"][0]["id"] == record["id"]
        with h.engine.connect() as c:
            assert c.scalar(select(users.c.id)) == other_id != owner


def test_w08_all_private_rows_and_stale_proofs_removed_rejoin_is_fresh(harness: Harness) -> None:
    h = harness
    owner = h.account()
    old_cookie = h.client.cookies.get(h.settings.cookie_name)
    link = request_link(h)
    signup_challenge = h.signup()
    signup_code = h.mail.messages[-1][1]
    with h.engine.begin() as c:
        c.execute(
            insert(google_flows).values(
                state_hash="a" * 64,
                session_hash=digest(old_cookie),
                created_at=h.clock.now,
                expires_at=h.clock.now + timedelta(minutes=10),
            )
        )
    challenge, value = begin(h)
    response = confirm(h, challenge, value)
    assert response.status_code == 204 and "Max-Age=0" in response.headers["Set-Cookie"]
    with h.engine.connect() as c:
        for table in (users, withdrawals, resets, google_flows, challenges):
            assert c.scalar(select(func.count()).select_from(table)) == 0
        # Other anonymous sessions may remain; no owned one or email-specific quota may.
        assert (
            c.scalar(select(func.count()).select_from(sessions).where(sessions.c.user_id == owner))
            == 0
        )
        keys = [
            keyed(h.settings.security_key.get_secret_value(), p, "person@example.com")
            for p in ("mail-email", "login-email")
        ]
        assert (
            c.scalar(select(func.count()).select_from(limits).where(limits.c.key_hash.in_(keys)))
            == 0
        )
        assert c.scalar(select(func.count()).select_from(limits)) > 0
    with h.new_client() as stale:
        stale.cookies.set(h.settings.cookie_name, old_cookie)
        assert stale.get("/api/v1/me").status_code == 401
        assert stale.get("/api/v1/records/stretch").status_code == 401
    assert reset(h, link).status_code == 400
    assert h.verify(signup_challenge, signup_code).status_code == 400
    new_owner = h.account()
    assert new_owner != owner
    assert h.client.get("/api/v1/records/stretch").json()["items"] == []


def test_w09_google_owned_account_uses_verified_email(harness: Harness) -> None:
    h = harness
    owner = h.account()
    with h.engine.begin() as c:
        c.execute(
            update(users)
            .where(users.c.id == owner)
            .values(password_hash=None, google_sub="synthetic-google")
        )
    challenge, value = begin(h)
    assert h.mail.messages[-1][0] == "person@example.com"
    assert confirm(h, challenge, value).status_code == 204


def test_w10_post_cascade_failure_rolls_back_everything(harness: Harness) -> None:
    h = harness
    h.account()
    record = payload(h)
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=record).status_code == 201
    )
    challenge, value = begin(h)
    headers = h.csrf()
    before = snapshot(h)

    def fail_after_cascade(*args: object) -> None:
        if str(args[2]).startswith("DELETE FROM signup_challenges"):
            raise SQLAlchemyError("synthetic failure after user DELETE")

    event.listen(h.engine, "before_cursor_execute", fail_after_cascade)
    try:
        assert (
            h.client.post(
                "/api/v1/me/delete/confirm",
                headers=headers,
                json={
                    "challenge_id": challenge,
                    "code": value,
                    "confirmation": "delete-my-account",
                },
            ).status_code
            == 503
        )
    finally:
        event.remove(h.engine, "before_cursor_execute", fail_after_cascade)
    assert snapshot(h) == before
    assert confirm(h, challenge, value).status_code == 204


def test_w11_actual_migration_preserves_records_and_refuses_pending_proof_loss(
    harness: Harness,
) -> None:
    h = harness
    owner = h.account()
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h)).status_code
        == 201
    )
    challenge, value = begin(h)
    config = Config("alembic.ini")
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "0004_stretch_records")
    with h.engine.connect() as c:
        assert (
            c.scalar(text("SELECT version_num FROM alembic_version")) == "0005_account_withdrawal"
        )
        assert c.scalar(select(withdrawals.c.user_id)) == owner
    with h.engine.begin() as c:  # Synthetic confirmation only; not a production rollback.
        c.execute(delete(withdrawals))
    command.downgrade(config, "0004_stretch_records")
    with h.engine.connect() as c:
        assert c.scalar(select(users.c.id)) == owner
        assert c.scalar(select(func.count()).select_from(stretch_records)) == 1
    command.upgrade(config, "head")
    inspector = inspect(h.engine)
    assert "ix_sessions_owner" in {i["name"] for i in inspector.get_indexes("sessions")}
    assert "ix_google_flows_session" in {i["name"] for i in inspector.get_indexes("google_flows")}
    assert confirm(h, challenge, value).status_code == 400
    assert h.client.get("/api/v1/me").status_code == 200


def test_w12_smtp_has_withdrawal_purpose_not_signup_or_reset(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[EmailMessage] = []

    async def capture(message: EmailMessage, **kwargs: object) -> None:
        sent.append(message)

    monkeypatch.setattr("app.main.aiosmtplib.send", capture)
    settings = harness.settings.model_copy(
        update={
            "smtp_username": SecretStr("synthetic@example.com"),
            "smtp_password": SecretStr("synthetic"),
        }
    )
    smtp_mail(settings, "person@example.com", "123456", purpose="withdrawal")
    assert str(sent[0]["Subject"]) == "BODYGUARD 회원 탈퇴 확인"
    assert "탈퇴 확인 코드: 123456" in sent[0].get_content()
    assert "계정과 저장된 수행 기록이 삭제" in sent[0].get_content()
    assert "가입 화면" not in sent[0].get_content()


def test_w12_synthetic_mail_cannot_launch_real_server(harness: Harness) -> None:
    h = harness
    settings = h.settings.model_copy(update={"environment": "development"})
    with pytest.raises(RuntimeError, match="Test dependencies"):
        create_app(settings, h.engine, withdraw_mail=h.mail)
    # The non-test instance deliberately uses real time, not the fixed fixture clock.
    h.clock.now = utcnow()
    h.account()
    with TestClient(create_app(settings, h.engine), base_url="http://localhost") as client:
        client.cookies.update(dict(h.client.cookies))
        response = client.post("/api/v1/me/delete/start", headers=h.csrf(client), json={})
        assert response.status_code == 503
        assert client.get("/api/v1/me").status_code == 200
