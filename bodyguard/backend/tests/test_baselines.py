"""FR-M-03: actual owned ASGI/PostgreSQL; synthetic account/clock/mail, no calibration."""

from datetime import timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, event, insert, select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.baselines import BaselineInput, _values
from app.db import baselines, users
from tests.conftest import Harness
from tests.test_account_withdrawal import begin, confirm
from tests.test_withdrawal_races import other_session

PATH = "/api/v1/baselines"


def payload() -> dict:
    return {
        "id": str(uuid4()),
        "client_version": "Fixture+V1",
        "neck": None,
        "shoulder": {"method": "fixture-shoulder", "unit": "deg", "value": 1.25},
        "trunk": None,
    }


def save(h: Harness, body: dict) -> dict:
    response = h.client.post(PATH, headers=h.csrf(), json=body)
    assert response.status_code == 201
    return response.json()


def test_b01_unset_is_null_not_a_guessed_baseline(harness: Harness) -> None:
    harness.account()
    response = harness.client.get(PATH + "/active")
    assert response.status_code == 200
    assert response.json() is None
    assert response.headers["cache-control"] == "no-store"
    with harness.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM baselines")) == 0


def test_b03_replace_history_retry_and_conflict(harness: Harness) -> None:
    h = harness
    h.account()
    body = payload()
    first = save(h, {**body, "id": body["id"].upper()})
    assert first["id"] == body["id"]
    assert first["provenance"] == "client-reported"
    assert set(first) == {*body, "created_at", "is_active", "provenance"}
    assert h.client.get(PATH + "/active").json() == first
    assert h.client.post(PATH, headers=h.csrf(), json=body).json() == first
    h.clock.now += timedelta(seconds=5)
    newer = save(h, payload())
    old = {**first, "is_active": False}
    retry = h.client.post(PATH, headers=h.csrf(), json=body)
    assert retry.status_code == 200 and retry.json() == old
    assert h.client.get(PATH + "/" + body["id"].upper()).json() == old
    assert h.client.get(PATH + "/active").json() == newer
    conflict = h.client.post(PATH, headers=h.csrf(), json={**body, "client_version": "changed"})
    assert conflict.status_code == 409
    assert h.client.get(PATH + "/active").json() == newer
    assert h.client.get(PATH + "/" + body["id"]).json() == old


def test_b01_other_owner_and_unknown_same404_and_same_id_independent(harness: Harness) -> None:
    h = harness
    h.account()
    body = payload()
    original = save(h, body)
    other_id = payload()["id"]
    original_cookie = h.client.cookies.get(h.settings.cookie_name)
    assert h.client.post("/api/v1/auth/logout", headers=h.csrf()).status_code == 204
    h.account("other@example.com")
    missing = h.client.get(PATH + "/" + body["id"])
    assert missing.status_code == 404
    assert h.client.get(PATH + "/" + other_id).json() == missing.json()
    assert h.client.get(PATH + "/not-a-uuid").json() == missing.json()
    assert h.client.get(PATH + "/active").json() is None
    same_id = save(h, {**body, "shoulder": {**body["shoulder"], "value": 3}})
    assert same_id["shoulder"] != original["shoulder"]
    # A revoked old cookie cannot regain any owner's baseline.
    with h.new_client() as stale:
        stale.cookies.set(
            h.settings.cookie_name, original_cookie, domain="localhost.local", path="/"
        )
        assert stale.get(PATH + "/active").status_code == 401


def test_b07_openapi_matches_retry_conflict_and_missing(harness: Harness) -> None:
    schema = harness.client.app.openapi()
    post = schema["paths"][PATH]["post"]["responses"]
    detail = schema["paths"][PATH + "/{baseline_id}"]["get"]["responses"]
    for status in ("200", "201"):
        assert post[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/BaselineOut"
        }
    for response, status in ((post, "409"), (detail, "404")):
        assert response[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorOut"
        }
    assert "provenance" in schema["components"]["schemas"]["BaselineOut"]["required"]


def test_b04_logout_old_cookie_and_proof_cannot_save(harness: Harness) -> None:
    h = harness
    h.account()
    saved = save(h, payload())
    old_cookie, proof = h.client.cookies.get(h.settings.cookie_name), h.csrf()
    assert h.client.post("/api/v1/auth/logout", headers=proof).status_code == 204
    h.client.cookies.set(h.settings.cookie_name, old_cookie, domain="localhost.local", path="/")
    assert h.client.get(PATH + "/active").status_code == 401
    assert h.client.post(PATH, headers=proof, json=payload()).status_code == 403
    assert h.login().status_code == 200
    assert h.client.get(PATH + "/active").json() == saved


def test_b06_db_token_length_bounds_are_structural(harness: Harness) -> None:
    h = harness
    owner = h.account()
    values = {
        **_values(BaselineInput.model_validate(payload())),
        "user_id": owner,
        "created_at": h.clock.now,
        "is_active": True,
    }
    for field in ("client_version", "shoulder_method", "shoulder_unit"):
        with pytest.raises(SQLAlchemyError) as error, h.engine.begin() as c:
            c.execute(insert(baselines).values(**{**values, field: "x" * 65}))
        assert getattr(error.value.orig, "sqlstate", None) == "22001"
    with h.engine.begin() as c:
        c.execute(
            insert(baselines).values(
                **{
                    **values,
                    "client_version": "x" * 64,
                    "shoulder_method": "X" * 64,
                    "shoulder_unit": "u" * 64,
                }
            )
        )
    assert h.client.get(PATH + "/active").json()["client_version"] == "x" * 64


@pytest.mark.parametrize(
    "change",
    [
        {"id": "not-uuid"},
        {"id": 1},
        {"client_version": ""},
        {"client_version": "x" * 65},
        {"client_version": "버전"},
        {"client_version": "A\n"},
        {"shoulder": None},
        {"shoulder": {}},
        {"shoulder": {"method": "x", "unit": "deg", "value": True}},
        {"shoulder": {"method": "x", "unit": "deg", "value": "1"}},
        {"shoulder": {"method": "x", "unit": "deg", "value": 9007199254740992}},
        {"neck": {"method": "", "unit": "deg", "value": 1}},
        {"neck": {"method": "x", "unit": "°", "value": 1}},
        {"trunk": {"method": "x", "unit": "deg"}},
        {"trunk": {"method": "x", "unit": "deg", "value": 1, "coordinates": []}},
        {"user_id": str(uuid4())},
        {"coordinates": []},
        {"samples": []},
        {"is_active": False},
        {"created_at": "2026-10-01T00:00:00Z"},
    ],
)
def test_b02_strict_no_raw_or_owner_input(harness: Harness, change: dict) -> None:
    h = harness
    h.account()
    saved = save(h, payload())
    response = h.client.post(PATH, headers=h.csrf(), json={**payload(), **change})
    assert response.status_code == 422
    assert response.json() == {"detail": "입력 형식을 확인해 주세요."}
    assert h.client.get(PATH + "/active").json() == saved


@pytest.mark.parametrize("field", ["id", "client_version", "neck", "shoulder", "trunk"])
def test_b02_missing_is_not_partial_update(harness: Harness, field: str) -> None:
    h = harness
    h.account()
    body = payload()
    del body[field]
    assert h.client.post(PATH, headers=h.csrf(), json=body).status_code == 422
    assert h.client.get(PATH + "/active").json() is None


@pytest.mark.parametrize("raw", ["NaN", "Infinity", "-Infinity"])
def test_b02_nonfinite_raw_json_is_sanitized(harness: Harness, raw: str) -> None:
    h = harness
    h.account()
    body = (
        '{"id":"' + str(uuid4()) + '","client_version":"v1","neck":null,'
        '"trunk":null,"shoulder":{"method":"x","unit":"deg","value":' + raw + "}}"
    )
    response = h.client.post(
        PATH, headers={**h.csrf(), "Content-Type": "application/json"}, content=body
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "입력 형식을 확인해 주세요."}


def test_b02_all_metrics_and_technical_number_bounds(harness: Harness) -> None:
    h = harness
    h.account()
    body = payload()
    for name, value in (("shoulder", 9007199254740991), ("neck", -9007199254740991), ("trunk", 0)):
        body[name] = {"method": "X" * 64, "unit": "A+.-_", "value": value}
    saved = save(h, body)
    for name in ("shoulder", "neck", "trunk"):
        assert saved[name] == body[name]


def test_b04_origin_proof_guest_expiry_and_credentials(harness: Harness) -> None:
    h = harness
    assert h.client.get(PATH + "/active").status_code == 401
    assert h.client.post(PATH, headers=h.csrf(), json=payload()).status_code == 401
    owner = h.account()
    proof = h.csrf()
    for headers in (
        {},
        {**proof, "Origin": "https://wrong.invalid"},
        {**proof, "X-CSRF-Token": "0" * 64},
    ):
        assert h.client.post(PATH, headers=headers, json=payload()).status_code == 403
    with other_session(h) as second:
        assert second.post(PATH, headers=proof, json=payload()).status_code == 403
        assert second.get(PATH + "/active").json() is None
    with h.engine.begin() as connection:
        connection.execute(update(users).where(users.c.id == owner).values(credentials_version=1))
    assert h.client.get(PATH + "/active").status_code == 401
    assert h.client.post(PATH, headers=proof, json=payload()).status_code == 403


def test_b05_rollback_deactivation_after_insert_failure(
    harness: Harness, caplog: pytest.LogCaptureFixture
) -> None:
    h = harness
    h.account()
    original = save(h, payload())
    proof = h.csrf()

    def fail(*args: object) -> None:
        if str(args[2]).startswith("INSERT INTO baselines"):
            raise SQLAlchemyError("PRIVATE_BASELINE_VALUE_DO_NOT_ECHO")

    event.listen(h.engine, "after_cursor_execute", fail)
    try:
        response = h.client.post(PATH, headers=proof, json=payload())
        assert response.status_code == 503
        assert response.json() == {"detail": "서비스 연결을 다시 시도해 주세요."}
        assert "PRIVATE_BASELINE" not in caplog.text
    finally:
        event.remove(h.engine, "after_cursor_execute", fail)
    assert h.client.get(PATH + "/active").json() == original
    with h.engine.connect() as c:
        assert c.scalar(text("SELECT count(*) FROM baselines")) == 1


def test_b05_withdrawal_owner_cascade_other_preserved(harness: Harness) -> None:
    h = harness
    owner = h.account()
    save(h, payload())
    save(h, payload())
    with h.new_client() as other:
        original = h.client
        try:
            h.client = other
            other_id = h.account("separate@example.com")
            other_baseline = save(h, payload())
        finally:
            h.client = original
        challenge, code = begin(h)
        assert confirm(h, challenge, code).status_code == 204
        assert other.get(PATH + "/active").json() == other_baseline
        with h.engine.connect() as c:
            assert c.scalar(select(baselines.c.user_id).where(baselines.c.user_id == owner)) is None
            assert c.scalar(select(baselines.c.user_id)) == other_id


def test_b06_actual_database_constraints_and_safe_downgrade(harness: Harness) -> None:
    h = harness
    owner = h.account()
    body = payload()
    saved = save(h, body)
    values = {
        **_values(BaselineInput.model_validate(body)),
        "user_id": owner,
        "created_at": h.clock.now,
        "is_active": False,
    }
    changes = [
        {"id": "not-uuid"},
        {"client_version": "bad\n"},
        {"client_version": ""},
        {"client_version": "한글"},
        {"neck_method": "x"},
        {"shoulder_value": None},
        {"shoulder_value": float("nan")},
        {"shoulder_value": float("inf")},
        {"shoulder_value": float("-inf")},
        {"shoulder_value": 9007199254740992},
        {"shoulder_value": -9007199254740992},
        {"shoulder_unit": ""},
        {"shoulder_method": "bad\n"},
        {"trunk_value": 2},
        {"is_active": True},
        {"user_id": str(uuid4())},
    ]
    for change in changes:
        with pytest.raises(IntegrityError), h.engine.begin() as c:
            c.execute(insert(baselines).values(**{**values, "id": str(uuid4()), **change}))
    with pytest.raises(IntegrityError), h.engine.begin() as c:
        c.execute(insert(baselines).values(**values))
    config = Config("alembic.ini")
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "0006_notification_preferences")
    assert h.client.get(PATH + "/active").json() == saved
    with h.engine.begin() as c:
        assert c.scalar(text("SELECT version_num FROM alembic_version")) == "0009_optional_profile"
        c.execute(delete(baselines))  # Only this fixture's synthetic rows on guarded test DB.
    try:
        command.downgrade(config, "0006_notification_preferences")
        with h.engine.connect() as c:
            assert c.scalar(select(users.c.id)) == owner
    finally:
        command.upgrade(config, "head")
    assert h.client.get(PATH + "/active").json() is None
