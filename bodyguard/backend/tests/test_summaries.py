"""FR-R-01/04: actual owned PostgreSQL summaries, not a posture accuracy test."""

import copy
import json
import subprocess
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, event, insert, select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db import minute_summaries, users
from app.readiness import EXPECTED_REVISION
from app.summaries import MinuteInput, _values
from tests.conftest import Harness
from tests.test_account_withdrawal import begin, confirm
from tests.test_baselines import payload as baseline_payload
from tests.test_baselines import save as save_baseline

PATH = "/api/v1/summaries"
PERIOD = {"start": "2026-09-30T23:00:00Z", "end": "2026-10-01T00:00:00Z"}


def payload(minute: int = 58, baseline_id: str | None = None) -> dict:
    metric = {
        "method": "fixture-shoulder",
        "unit": "deg",
        "dev_mean": None,
        "measured_sec": 0,
        "bad_sec": 0,
    }
    return {
        "minute_start": f"2026-09-30T23:{minute:02}:00Z",
        "baseline_id": baseline_id,
        "client_version": "Fixture+V1",
        "coverage_sec": 60,
        "measured_sec": 30,
        "unmeasurable_sec": 20,
        "present_sec": 45,
        "background_sec": 10,
        "any_bad_sec": 15,
        "neck": {**metric, "method": "fixture-neck"},
        "shoulder": {**metric, "dev_mean": 1.25, "measured_sec": 30, "bad_sec": 15},
        "trunk": {**metric, "method": "fixture-trunk"},
    }


def post(h: Harness, *items: dict):
    return h.client.post(PATH + "/batch", headers=h.csrf(), json={"items": list(items)})


def preview(h: Harness) -> dict:
    response = h.client.post(PATH + "/delete-preview", headers=h.csrf(), json=PERIOD)
    assert response.status_code == 200
    return response.json()


def remove(h: Harness, proof: dict):
    return h.client.post(
        PATH + "/delete",
        headers=h.csrf(),
        json={**proof, "confirmation": "delete-minute-summaries"},
    )


def test_owned_summary_list_is_empty(harness):
    h = harness
    h.account()
    response = h.client.get("/api/v1/summaries")
    assert response.status_code == 200
    assert response.json() == {"items": [], "has_more": False}


def test_roundtrip_retry_order_and_atomic_conflict(harness):
    h = harness
    h.account()
    first, second = payload(58), payload(59)
    saved = post(h, second, first)
    assert saved.status_code == 201
    rows = saved.json()["items"]
    assert [row["minute_start"] for row in rows] == ["2026-09-30T23:58:00Z", "2026-09-30T23:59:00Z"]
    assert all(
        row["provenance"] == "client-reported" and set(row) == {*first, "created_at", "provenance"}
        for row in rows
    )
    retried = post(h, first, second)
    assert retried.status_code == 200 and retried.json() == saved.json()
    conflict = copy.deepcopy(second)
    conflict["shoulder"]["dev_mean"] = 2
    assert post(h, payload(57), conflict).status_code == 409
    listed = h.client.get(PATH).json()
    assert listed["items"] == rows[::-1] and listed["has_more"] is False
    paged = h.client.get(PATH, params={"limit": 1})
    assert paged.json() == {"items": [rows[1]], "has_more": True}
    assert h.client.get(PATH, params={"limit": 1, "offset": 1}).json() == {
        "items": [rows[0]],
        "has_more": False,
    }
    assert h.client.get(
        PATH, params={"start": second["minute_start"], "end": PERIOD["end"]}
    ).json()["items"] == [rows[1]]
    assert h.client.get(PATH).headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "change",
    [
        {"coverage_sec": True},
        {"measured_sec": "30"},
        {"coverage_sec": 60.001},
        {"background_sec": -1},
        {"measured_sec": 45},
        {"present_sec": 20},
        {"present_sec": 51},
        {"any_bad_sec": 16},
        {"any_bad_sec": 14},
        {"client_version": "bad\n"},
        {"user_id": str(uuid4())},
        {"raw_samples": []},
        {"landmarks": []},
        {"minute_start": 1790899080},
        {"minute_start": "1790899080"},
        {"minute_start": "2026-09-30T23:58:00"},
        {"minute_start": "2026-09-30T23:58:01Z"},
        {"minute_start": "2026-09-30T23:58:00.000001Z"},
        {"minute_start": "2026-10-01T00:05:00Z"},
        {"minute_start": "9999-12-31T23:59:00Z"},
        {
            "shoulder": {
                "method": "fixture-shoulder",
                "unit": "deg",
                "dev_mean": None,
                "measured_sec": 30,
                "bad_sec": 15,
            }
        },
        {
            "shoulder": {
                "method": "fixture-shoulder",
                "unit": "deg",
                "dev_mean": 1,
                "measured_sec": 10,
                "bad_sec": 15,
            }
        },
        {
            "neck": {
                "method": "fixture-neck",
                "unit": "deg",
                "dev_mean": 1,
                "measured_sec": 1,
                "bad_sec": 0,
            }
        },
    ],
)
def test_strict_input_does_not_overwrite(harness, change):
    h = harness
    h.account()
    saved = post(h, payload()).json()
    rejected = post(h, {**payload(), **change})
    assert rejected.status_code == 422
    assert rejected.json() == {"detail": "입력 형식을 확인해 주세요."}
    assert h.client.get(PATH).json()["items"] == saved["items"]


@pytest.mark.parametrize(
    "body",
    [
        {"items": []},
        {"items": [payload()] * 2},
        {"items": [payload()] * 61},
        {"items": [payload()], "owner": "other"},
    ],
)
def test_batch_bound_and_duplicates(harness, body):
    h = harness
    h.account()
    assert h.client.post(PATH + "/batch", headers=h.csrf(), json=body).status_code == 422
    assert h.client.get(PATH).json()["items"] == []


@pytest.mark.parametrize(
    "query",
    [
        {"start": "1790899080"},
        {"start": "2026-10-01"},
        {"start": "2026-10-01T00:00:00"},
        {"limit": 101},
        {"offset": 10001},
        {"start": PERIOD["end"], "end": PERIOD["start"]},
    ],
)
def test_bounded_explicit_period_query(harness, query):
    harness.account()
    assert harness.client.get(PATH, params=query).status_code == 422


def test_baseline_owner_history_and_method_boundaries(harness):
    h = harness
    h.account()
    baseline = save_baseline(h, baseline_payload())
    body = payload(baseline_id=baseline["id"].upper())
    assert post(h, body).status_code == 201
    save_baseline(h, baseline_payload())
    assert post(h, body).status_code == 200  # Historical inactive baseline remains valid.
    for change in (
        {"baseline_id": str(uuid4())},
        {"client_version": "different"},
        {"shoulder": {**body["shoulder"], "method": "other-method"}},
        {"neck": {**body["neck"], "dev_mean": 1, "measured_sec": 1}},
    ):
        assert (
            post(h, {**body, "minute_start": payload(59)["minute_start"], **change}).status_code
            == 422
        )
    assert h.client.post("/api/v1/auth/logout", headers=h.csrf()).status_code == 204
    h.account("other@example.com")
    assert h.client.get(PATH).json()["items"] == []
    assert post(h, body).status_code == 422
    assert post(h, payload()).status_code == 201  # Same minute owned separately.


def test_auth_origin_csrf_and_no_malformed_echo(harness):
    h = harness
    assert h.client.get(PATH).status_code == 401
    assert post(h, payload()).status_code == 401
    h.account()
    valid = h.csrf()
    for headers in (
        {},
        {**valid, "Origin": "https://other.invalid"},
        {**valid, "X-CSRF-Token": "f" * 64},
    ):
        assert (
            h.client.post(PATH + "/batch", headers=headers, json={"items": [payload()]}).status_code
            == 403
        )
    cookie = h.client.cookies.get(h.settings.cookie_name)
    assert h.client.post("/api/v1/auth/logout", headers=valid).status_code == 204
    h.client.cookies.set(h.settings.cookie_name, cookie, domain="localhost.local", path="/")
    assert h.client.get(PATH).status_code == 401
    assert (
        h.client.post(PATH + "/batch", headers=valid, json={"items": [payload()]}).status_code
        == 403
    )


def test_period_deletion_preserves_post_cutoff_and_retries(harness):
    h = harness
    h.account()
    assert post(h, payload(58)).status_code == 201
    proof = preview(h)
    assert proof["count"] == 1
    h.clock.now += timedelta(seconds=1)
    assert post(h, payload(59)).status_code == 201
    assert remove(h, proof).json() == {"deleted": 1}
    assert remove(h, proof).json() == {"deleted": 0}
    assert h.client.get(PATH).json()["items"][0]["minute_start"] == payload(59)["minute_start"]
    assert remove(h, preview(h)).json() == {"deleted": 1}


def test_period_deletion_changed_target_is_atomic(harness):
    h = harness
    owner = h.account()
    assert post(h, payload(58), payload(59)).status_code == 201
    proof = preview(h)
    with h.engine.begin() as c:
        c.execute(
            update(minute_summaries)
            .where(minute_summaries.c.user_id == owner)
            .values(shoulder_dev_mean=9)
        )
    assert remove(h, proof).status_code == 409
    assert len(h.client.get(PATH).json()["items"]) == 2


def test_delete_proof_cannot_cross_scope_session_or_fields(harness):
    h = harness
    h.account()
    assert post(h, payload()).status_code == 201
    proof = preview(h)
    for change in ({"signature": "a" * 64}, {"count": 0}, {"start": "2026-09-29T00:00:00Z"}):
        assert remove(h, {**proof, **change}).status_code == 403
    stretch = h.client.post(
        "/api/v1/records/stretch/delete-preview", headers=h.csrf(), json=PERIOD
    ).json()
    assert remove(h, stretch).status_code == 403
    assert (
        h.client.post(
            "/api/v1/records/stretch/delete",
            headers=h.csrf(),
            json={**proof, "confirmation": "delete-stretch-records"},
        ).status_code
        == 403
    )
    assert h.login().status_code == 200
    assert remove(h, proof).status_code == 403
    assert len(h.client.get(PATH).json()["items"]) == 1


def test_delete_expiry_and_empty_retry(harness):
    h = harness
    h.account()
    assert remove(h, preview(h)).json() == {"deleted": 0}
    assert post(h, payload()).status_code == 201
    proof = preview(h)
    h.clock.now += timedelta(minutes=10)
    assert remove(h, proof).status_code == 409
    assert len(h.client.get(PATH).json()["items"]) == 1


def test_delete_maximum_utc_proof_is422_not500(harness):
    h = harness
    h.account()
    proof = preview(h)
    for change in (
        {"cutoff": "9999-12-31T23:59:00Z", "expires_at": "9999-12-31T23:59:00Z"},
        {"cutoff": "0001-01-01T00:00:00+01:00"},
    ):
        assert remove(h, {**proof, **change}).status_code == 422


def test_actual_withdrawal_cascades_only_own_summary(harness):
    h = harness
    owner = h.account()
    assert post(h, payload()).status_code == 201
    with h.new_client() as other:
        original = h.client
        try:
            h.client = other
            other_id = h.account("other@example.com")
            assert post(h, payload()).status_code == 201
        finally:
            h.client = original
        challenge, code = begin(h)
        assert confirm(h, challenge, code).status_code == 204
        assert h.client.get(PATH).status_code == 401
        assert len(other.get(PATH).json()["items"]) == 1
    with h.engine.connect() as c:
        assert c.scalar(select(users.c.id).where(users.c.id == owner)) is None
        assert c.execute(select(minute_summaries.c.user_id)).scalars().all() == [other_id]


def test_database_failure_rolls_back_all_rows(harness):
    h = harness
    h.account()
    count = 0

    def fail(*args):
        nonlocal count
        if str(args[2]).startswith("INSERT INTO minute_summaries"):
            count += 1
            if count == 2:
                raise SQLAlchemyError("PRIVATE_SUMMARY_NEVER_ECHO")

    event.listen(h.engine, "after_cursor_execute", fail)
    try:
        response = post(h, payload(58), payload(59))
        assert response.status_code == 503 and "PRIVATE_SUMMARY" not in response.text
    finally:
        event.remove(h.engine, "after_cursor_execute", fail)
    assert h.client.get(PATH).json()["items"] == []


@pytest.mark.parametrize(
    "change,state",
    [
        ({"user_id": str(uuid4())}, "23503"),
        ({"baseline_id": str(uuid4())}, "23503"),
        ({"coverage_sec": None}, "23502"),
        ({"coverage_sec": float("nan")}, "23514"),
        ({"coverage_sec": float("inf")}, "23514"),
        ({"coverage_sec": 59}, "23514"),
        ({"shoulder_dev_mean": None}, "23514"),
        ({"neck_method": "bad\n"}, "23514"),
        ({"client_version": "bad\n"}, "23514"),
        ({"any_bad_sec": 14}, "23514"),
    ],
)
def test_actual_sql_constraints(harness, change, state):
    h = harness
    owner = h.account()
    values = {
        "user_id": owner,
        "created_at": h.clock(),
        **_values(MinuteInput.model_validate(payload())),
        **change,
    }
    with pytest.raises(IntegrityError) as error, h.engine.begin() as c:
        c.execute(insert(minute_summaries).values(**values))
    assert error.value.orig.sqlstate == state


def test_downgrade_refuses_nonempty_and_preserves_history(harness):
    h = harness
    h.account()
    assert post(h, payload()).status_code == 201
    config = Config("alembic.ini")
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "0007_account_baselines")
    with h.engine.connect() as c:
        assert c.scalar(text("SELECT version_num FROM alembic_version")) == EXPECTED_REVISION
        assert len(c.execute(select(minute_summaries)).all()) == 1
    with h.engine.begin() as c:
        c.execute(delete(minute_summaries))
    try:
        command.downgrade(config, "0007_account_baselines")
    finally:
        command.upgrade(config, "head")
    assert h.client.get(PATH).json()["items"] == []


def test_actual_ts_fractional_aggregates_roundtrip(harness):
    h = harness
    h.account()
    body = baseline_payload()
    for name in ("neck", "trunk"):
        body[name] = {"method": f"fixture-{name}", "unit": "deg", "value": 1}
    baseline = save_baseline(h, body)
    result = subprocess.run(
        ["node", str(Path(__file__).with_name("minute_fixture.mjs")), baseline["id"]],
        capture_output=True,
        text=True,
        timeout=15,
        check=True,
    )
    items = json.loads(result.stdout)
    assert len(items) == 10 and any(item["measured_sec"] % 1 for item in items)
    response = post(h, *items)
    assert response.status_code == 201
    for expected, actual in zip(items, response.json()["items"], strict=True):
        assert actual == {
            **expected,
            "minute_start": expected["minute_start"].replace(".000Z", "Z"),
            "created_at": "2026-10-01T00:00:00Z",
            "provenance": "client-reported",
        }


@pytest.mark.parametrize(
    "value", ["0001-01-01T00:00:00+01:00", "9999-12-31T23:59:00-01:00", "2026-02-30T00:00:00Z"]
)
def test_utc_overflow_and_invalid_date_are422(harness, value):
    h = harness
    h.account()
    assert post(h, {**payload(), "minute_start": value}).status_code == 422
    assert h.client.get(PATH, params={"start": value}).status_code == 422
    assert (
        h.client.post(
            PATH + "/delete-preview", headers=h.csrf(), json={**PERIOD, "start": value}
        ).status_code
        == 422
    )


def test_sql_utc_boundary_is_independent_of_historical_seconds_offset(harness):
    h = harness
    h.account()
    assert post(h, payload()).status_code == 201
    with h.engine.begin() as c:
        c.execute(text("SET LOCAL TIME ZONE 'Africa/Monrovia'"))
        c.execute(
            text("UPDATE minute_summaries SET minute_start = '1970-01-01T00:00:00Z'::timestamptz")
        )
        assert (
            str(c.scalar(text("SELECT minute_start AT TIME ZONE 'UTC' FROM minute_summaries")))
            == "1970-01-01 00:00:00"
        )
    for value in (
        "1970-01-01T00:00:30Z",
        "infinity",
        "-infinity",
        "10000-01-01T00:00:00Z",
        "0001-01-01 00:00:00 BC",
    ):
        with pytest.raises(IntegrityError) as error, h.engine.begin() as c:
            c.execute(text("SET LOCAL TIME ZONE 'Africa/Monrovia'"))
            c.execute(
                text("UPDATE minute_summaries SET minute_start = CAST(:value AS timestamptz)"),
                {"value": value},
            )
        assert error.value.orig.sqlstate == "23514"


@pytest.mark.parametrize("missing", list(payload()))
def test_missing_input_is_not_defaulted(harness, missing):
    h = harness
    h.account()
    body = payload()
    del body[missing]
    assert post(h, body).status_code == 422
    assert h.client.get(PATH).json()["items"] == []


def test_openapi_retry_conflict_delete_and_provenance(harness):
    schema = harness.client.app.openapi()
    responses = schema["paths"][PATH + "/batch"]["post"]["responses"]
    for status in ("200", "201"):
        assert responses[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/MinuteList"
        }
    assert responses["409"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorOut"
    }
    assert "provenance" in schema["components"]["schemas"]["MinuteOut"]["required"]
    assert schema["components"]["schemas"]["MinuteInput"]["additionalProperties"] is False
    assert schema["components"]["schemas"]["MinuteMetric"]["additionalProperties"] is False
    for suffix in ("/delete", "/delete-preview"):
        assert "post" in schema["paths"][PATH + suffix]


def test_openapi_fixed_errors_match_actual_api(harness):
    schema = harness.client.app.openapi()
    for suffix, method, statuses in (
        ("/batch", "post", (401, 403, 409, 422, 503)),
        ("", "get", (401, 422, 503)),
        ("/delete-preview", "post", (401, 403, 422, 503)),
        ("/delete", "post", (401, 403, 409, 422, 503)),
    ):
        for status in statuses:
            assert schema["paths"][PATH + suffix][method]["responses"][str(status)]["content"][
                "application/json"
            ]["schema"] == {"$ref": "#/components/schemas/ErrorOut"}


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_json_cannot_be_stored_or_echoed(harness, value, caplog):
    h = harness
    h.account()
    raw = json.dumps({"items": [payload()]})
    raw = raw.replace('"coverage_sec": 60', f'"coverage_sec": {value}')
    response = h.client.post(
        PATH + "/batch", headers={**h.csrf(), "Content-Type": "application/json"}, content=raw
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "입력 형식을 확인해 주세요."}
    assert value not in caplog.text
    assert h.client.get(PATH).json()["items"] == []


def all_bad_payload(h):
    baseline = baseline_payload()
    for name in ("neck", "trunk"):
        baseline[name] = {"method": f"fixture-{name}", "unit": "deg", "value": 1}
    saved = save_baseline(h, baseline)
    body = {
        **payload(baseline_id=saved["id"]),
        "coverage_sec": 60,
        "measured_sec": 60,
        "unmeasurable_sec": 0,
        "present_sec": 60,
        "background_sec": 0,
        "any_bad_sec": 60,
    }
    for name in ("neck", "shoulder", "trunk"):
        body[name] = {
            "method": f"fixture-{name}",
            "unit": "deg",
            "dev_mean": 1,
            "measured_sec": 20,
            "bad_sec": 20,
        }
    return body


def test_impossible_good_coverage_union_is422(harness):
    h = harness
    h.account()
    body = all_bad_payload(h)
    assert post(h, {**body, "any_bad_sec": 20}).status_code == 422
    assert post(h, body).status_code == 201


def test_impossible_good_coverage_union_sql_is23514(harness):
    h = harness
    owner = h.account()
    body = all_bad_payload(h)
    values = {
        "user_id": owner,
        "created_at": h.clock(),
        **_values(MinuteInput.model_validate(body)),
        "any_bad_sec": 20,
    }
    with pytest.raises(IntegrityError) as error, h.engine.begin() as c:
        c.execute(insert(minute_summaries).values(**values))
    assert error.value.orig.sqlstate == "23514"
