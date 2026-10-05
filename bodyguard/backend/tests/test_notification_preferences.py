"""FR-N-03/FR-U-04/05: actual HTTP/SQL, clock and mail synthetic; no notification firing."""

from datetime import timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, event, insert, select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db import notification_preferences, users
from tests.conftest import Harness
from tests.test_account_withdrawal import begin, confirm
from tests.test_withdrawal_races import other_session

PATH = "/api/v1/settings/notifications"
DEFAULT = {
    "posture_enabled": True,
    "posture_minutes": 5,
    "sitting_enabled": True,
    "sitting_minutes": 50,
    "sound_enabled": False,
}
CHANGED = {**DEFAULT, "posture_enabled": False, "posture_minutes": 15, "sitting_minutes": 90}


def test_p01_defaults_read_without_settings_write(harness: Harness) -> None:
    h = harness
    h.account()
    for _ in range(2):
        response = h.client.get(PATH)
        assert response.status_code == 200
        assert response.json() == DEFAULT
        assert response.headers["cache-control"] == "no-store"
    with h.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM notification_preferences")) == 0


def test_p02_persist_retry_one_row_and_other_account_isolation(harness: Harness) -> None:
    h = harness
    owner = h.account()
    proof = h.csrf()
    for _ in range(2):
        saved = h.client.post(PATH, headers=proof, json=CHANGED)
        assert saved.status_code == 200
        assert saved.json() == CHANGED
    assert h.client.get(PATH).json() == CHANGED
    with h.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM notification_preferences")) == 1
    assert h.client.post("/api/v1/auth/logout", headers=h.csrf()).status_code == 204
    other = h.account("other@example.com")
    assert other != owner
    assert h.client.get(PATH).json() == DEFAULT
    assert (
        h.client.post(PATH, headers=h.csrf(), json={**DEFAULT, "sound_enabled": True}).status_code
        == 200
    )
    assert h.client.post("/api/v1/auth/logout", headers=h.csrf()).status_code == 204
    assert h.login().status_code == 200
    assert h.client.get(PATH).json() == CHANGED
    with h.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM notification_preferences")) == 2


@pytest.mark.parametrize(
    "change",
    [
        {"posture_minutes": 0},
        {"posture_minutes": 1441},
        {"posture_minutes": True},
        {"posture_minutes": "5"},
        {"posture_minutes": 5.5},
        {"sitting_minutes": -1},
        {"sitting_minutes": 1441},
        {"sitting_minutes": None},
        {"posture_enabled": "false"},
        {"posture_enabled": 1},
        {"sitting_enabled": None},
        {"sound_enabled": 0},
        {"user_id": str(uuid4())},
        {"sensitivity": 1},
        {"email": "other@example.com"},
    ],
)
def test_p03_strict_input_preserves_previous_settings(
    harness: Harness, change: dict[str, object]
) -> None:
    h = harness
    h.account()
    assert h.client.post(PATH, headers=h.csrf(), json=CHANGED).status_code == 200
    response = h.client.post(PATH, headers=h.csrf(), json={**DEFAULT, **change})
    assert response.status_code == 422
    assert response.json() == {"detail": "입력 형식을 확인해 주세요."}
    assert h.client.get(PATH).json() == CHANGED


@pytest.mark.parametrize("missing", list(DEFAULT))
def test_p03_missing_field_is_not_an_implicit_partial_update(
    harness: Harness, missing: str
) -> None:
    h = harness
    h.account()
    body = {key: value for key, value in DEFAULT.items() if key != missing}
    assert h.client.post(PATH, headers=h.csrf(), json=body).status_code == 422
    assert h.client.get(PATH).json() == DEFAULT


@pytest.mark.parametrize("minutes", [1, 1440])
def test_p03_technical_bounds_and_both_opt_out(harness: Harness, minutes: int) -> None:
    h = harness
    h.account()
    body = {
        **DEFAULT,
        "posture_enabled": False,
        "sitting_enabled": False,
        "posture_minutes": minutes,
        "sitting_minutes": minutes,
    }
    assert h.client.post(PATH, headers=h.csrf(), json=body).json() == body
    assert h.client.get(PATH).json() == body


def test_p04_guest_origin_csrf_and_revoked_account(harness: Harness) -> None:
    h = harness
    assert h.client.get(PATH).status_code == 401
    assert h.client.post(PATH, headers=h.csrf(), json=CHANGED).status_code == 401
    owner = h.account()
    valid = h.csrf()
    for headers in [
        {},
        {**valid, "Origin": "https://other.invalid"},
        {**valid, "X-CSRF-Token": "f" * 64},
    ]:
        assert h.client.post(PATH, headers=headers, json=CHANGED).status_code == 403
    assert h.client.get(PATH).json() == DEFAULT
    with h.engine.begin() as connection:
        connection.execute(update(users).where(users.c.id == owner).values(credentials_version=1))
    assert h.client.get(PATH).status_code == 401
    assert h.client.post(PATH, headers=valid, json=CHANGED).status_code == 403


def test_p04_expired_session_cannot_read_or_write(harness: Harness) -> None:
    h = harness
    h.account()
    proof = h.csrf()
    assert h.client.post(PATH, headers=proof, json=CHANGED).status_code == 200
    h.clock.now += timedelta(minutes=31)
    assert h.client.get(PATH).status_code == 401
    assert h.client.post(PATH, headers=proof, json=DEFAULT).status_code == 403


def test_p05_actual_withdrawal_cascades_only_owner_settings(harness: Harness) -> None:
    h = harness
    owner = h.account()
    assert h.client.post(PATH, headers=h.csrf(), json=CHANGED).status_code == 200
    # Independent actual account remains authenticated and retains its own preferences.
    with h.new_client() as other:
        original = h.client
        try:
            h.client = other
            other_id = h.account("separate@example.com")
        finally:
            h.client = original
        other_settings = {**DEFAULT, "sitting_minutes": 75}
        assert other.post(PATH, headers=h.csrf(other), json=other_settings).status_code == 200
        challenge, code = begin(h)
        assert confirm(h, challenge, code).status_code == 204
        assert h.client.get(PATH).status_code == 401
        assert other.get("/api/v1/me").json()["id"] == other_id
        assert other.get(PATH).json() == other_settings
    with h.engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM notification_preferences WHERE user_id = :owner"),
                {"owner": owner},
            )
            == 0
        )
        assert connection.scalar(select(users.c.id).where(users.c.id == owner)) is None
        assert connection.scalar(select(users.c.id).where(users.c.id == other_id)) == other_id


def test_p02_other_session_reads_persisted_settings_and_old_cookie_proof_cannot_cross(
    harness: Harness,
) -> None:
    h = harness
    h.account()
    old_proof = h.csrf()
    with other_session(h) as second:
        assert second.post(PATH, headers=h.csrf(second), json=CHANGED).status_code == 200
        assert h.client.get(PATH).json() == CHANGED
        assert second.post(PATH, headers=old_proof, json=DEFAULT).status_code == 403
        assert h.client.get(PATH).json() == CHANGED
    assert h.client.post("/api/v1/auth/logout", headers=h.csrf()).status_code == 204
    assert h.client.get(PATH).status_code == 401


def test_p05_actual_database_constraints_and_safe_migration(harness: Harness) -> None:
    h = harness
    owner = h.account()
    for change in [{"posture_minutes": 0}, {"sitting_minutes": 1441}, {"sound_enabled": None}]:
        with pytest.raises(IntegrityError), h.engine.begin() as connection:
            connection.execute(
                insert(notification_preferences).values(user_id=owner, **{**DEFAULT, **change})
            )
    with pytest.raises(IntegrityError), h.engine.begin() as connection:
        connection.execute(insert(notification_preferences).values(user_id=str(uuid4()), **DEFAULT))
    assert h.client.post(PATH, headers=h.csrf(), json=CHANGED).status_code == 200
    config = Config("alembic.ini")
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "0005_account_withdrawal")
    assert h.client.get(PATH).json() == CHANGED
    with h.engine.begin() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0006_notification_preferences"
        )
        # Only synthetic preferences in this exclusively guarded test DB are removed.
        connection.execute(delete(notification_preferences))
    try:
        command.downgrade(config, "0005_account_withdrawal")
        with h.engine.connect() as connection:
            assert connection.scalar(select(users.c.id)) == owner
    finally:
        command.upgrade(config, "head")
    assert h.client.get(PATH).json() == DEFAULT


def test_p05_database_failure_rolls_back_whole_replacement(harness: Harness) -> None:
    h = harness
    h.account()
    assert h.client.post(PATH, headers=h.csrf(), json=CHANGED).status_code == 200

    def fail_after_write(*args: object) -> None:
        if str(args[2]).startswith("INSERT INTO notification_preferences"):
            raise SQLAlchemyError("PRIVATE_PREFERENCE_BODY_NO_LOG_OR_ECHO")

    proof = h.csrf()
    event.listen(h.engine, "after_cursor_execute", fail_after_write)
    try:
        result = h.client.post(PATH, headers=proof, json=DEFAULT)
        assert result.status_code == 503
        assert result.json() == {"detail": "서비스 연결을 다시 시도해 주세요."}
    finally:
        event.remove(h.engine, "after_cursor_execute", fail_after_write)
    assert h.client.get(PATH).json() == CHANGED
