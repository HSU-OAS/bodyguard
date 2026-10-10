"""FR-R-03/06: synthetic records, real owned PostgreSQL; not clinical accuracy."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event, insert

from app.db import minute_summaries, stretch_records
from app.summaries import MinuteInput, _values
from tests.test_baselines import payload as baseline_payload
from tests.test_baselines import save as save_baseline
from tests.test_summaries import payload, post

PATH = "/api/v1/records/dashboard"
QUERY = {"date": "2026-10-01", "period": "day", "timezone": "Asia/Seoul"}


def get(h, **change):
    return h.client.get(PATH, params={**QUERY, **change})


def test_empty_dashboard_has_no_fabricated_metrics_or_notifications(harness):
    h = harness
    h.account()
    response = get(h)
    assert response.status_code == 200
    row = response.json()
    assert row["start"] == "2026-09-30T15:00:00Z"
    assert row["end"] == "2026-10-01T15:00:00Z"
    assert row["totals"]["minutes"] == 0 and row["totals"]["measured_sec"] == 0
    assert row["metrics"] == [] and row["notifications"] is None
    assert row["stretch"] == {"completed": 0, "interrupted": 0, "skipped": 0}
    assert response.headers["cache-control"] == "no-store"


def test_weighted_means_null_method_and_version_separation(harness):
    h = harness
    h.account()
    first = payload(58)
    second = payload(59)
    second.update(measured_sec=10, unmeasurable_sec=40, any_bad_sec=5)
    second["shoulder"].update(dev_mean=5.25, measured_sec=10, bad_sec=5)
    third = payload(57)
    third["client_version"] = "Fixture+V2"
    third["shoulder"]["unit"] = "ratio"
    assert post(h, first, second, third).status_code == 201
    row = get(h).json()
    assert row["totals"]["minutes"] == 3
    shoulder = [part for part in row["metrics"] if part["part"] == "shoulder"]
    assert len(shoulder) == 2
    degree = next(part for part in shoulder if part["unit"] == "deg")
    assert degree["measured_sec"] == 40
    assert degree["dev_mean"] == pytest.approx(2.25)
    assert degree["bad_ratio"] == 0.5
    assert all(
        part["dev_mean"] is None and part["bad_ratio"] is None
        for part in row["metrics"]
        if part["part"] != "shoulder"
    )


@pytest.mark.parametrize("date,hours", [("2026-03-08", 23), ("2026-11-01", 25)])
def test_real_iana_dst_calendar_day(harness, date, hours):
    h = harness
    h.account()
    response = get(h, date=date, timezone="America/New_York")
    assert response.status_code == 200
    value = response.json()
    assert (
        datetime.fromisoformat(value["end"]) - datetime.fromisoformat(value["start"])
    ).total_seconds() == hours * 3600


@pytest.mark.parametrize(
    "change",
    [
        {"date": "2026-02-30"},
        {"date": "0000-01-01"},
        {"period": "month"},
        {"timezone": "missing/zone"},
        {"timezone": "A" * 256},
        {"date": "2011-12-30", "timezone": "Pacific/Apia"},
        {"date": "9999-12-31"},
        {"date": "0001-01-01", "timezone": "Asia/Seoul"},
    ],
)
def test_invalid_or_nonexistent_date_rejected(harness, change):
    harness.account()
    assert get(harness, **change).status_code == 422


def test_week_uses_all_minutes_above_pagination_limit_and_one_statement(harness):
    h = harness
    owner = h.account()
    start = datetime(2026, 9, 28, tzinfo=UTC)
    base = _values(MinuteInput.model_validate(payload()))
    with h.engine.begin() as connection:
        connection.execute(
            insert(minute_summaries),
            [
                {
                    **base,
                    "user_id": owner,
                    "minute_start": start + timedelta(minutes=index),
                    "created_at": h.clock.now,
                }
                for index in range(10080)
            ],
        )
    statements = []

    def captured(conn, cursor, statement, parameters, context, executemany):
        if "minute_summaries" in statement or "stretch_records" in statement:
            statements.append(statement)

    event.listen(h.engine, "before_cursor_execute", captured)
    try:
        response = get(h, date="2026-10-01", period="week", timezone="UTC")
    finally:
        event.remove(h.engine, "before_cursor_execute", captured)
    assert response.status_code == 200
    assert response.json()["totals"]["minutes"] == 10080
    assert response.json()["totals"]["measured_sec"] == 10080 * 30
    assert len(statements) == 1


def test_owned_start_time_half_open_performer_counts(harness):
    h = harness
    owner = h.account()
    start = datetime(2026, 9, 30, 15, tzinfo=UTC)
    with h.engine.begin() as connection:
        connection.execute(
            insert(stretch_records),
            [
                {
                    "user_id": owner,
                    "id": f"00000000-0000-4000-8000-{index:012d}",
                    "motion_id": "fixture",
                    "protocol_version": "Fixture+V1",
                    "started_at": at,
                    "ended_at": at + timedelta(hours=1),
                    "outcome": outcome,
                    "observed_ms": 0,
                    "repetitions": 0,
                    "created_at": h.clock.now,
                }
                for index, (at, outcome) in enumerate(
                    [
                        (start - timedelta(seconds=1), "completed"),
                        (start, "completed"),
                        (start + timedelta(hours=23, minutes=59), "interrupted"),
                        (start + timedelta(hours=12), "skipped"),
                        (start + timedelta(days=1), "completed"),
                    ]
                )
            ],
        )
    assert get(h).json()["stretch"] == {"completed": 1, "interrupted": 1, "skipped": 1}
    proof = h.csrf()["X-CSRF-Token"]
    a = owner
    cookies_a = dict(h.client.cookies)
    h.client.cookies.clear()
    b = h.account("other-dashboard@example.com")
    assert get(h).json()["totals"]["minutes"] == 0
    assert get(h).json()["stretch"] == {"completed": 0, "interrupted": 0, "skipped": 0}
    assert (
        h.client.get(
            PATH, params=QUERY, headers={"X-CSRF-Token": proof, "X-Account-ID": a}
        ).status_code
        == 403
    )
    h.client.cookies.clear()
    h.client.cookies.update(cookies_a)
    assert get(h).json()["stretch"]["completed"] == 1
    assert b != a


def test_guest_cannot_read_dashboard(harness):
    assert get(harness).status_code == 401


def test_baseline_method_unit_and_version_are_independent_partitions(harness):
    h = harness
    h.account()
    baseline_a = save_baseline(h, baseline_payload())["id"]
    baseline_b = save_baseline(h, baseline_payload())["id"]
    items = [payload(index) for index in range(50, 56)]
    items[1]["baseline_id"] = baseline_a
    items[2]["baseline_id"] = baseline_b
    items[3]["client_version"] = "Fixture+V2"
    items[4]["shoulder"]["method"] = "fixture-other"
    items[5]["shoulder"]["unit"] = "ratio"
    assert post(h, *items).status_code == 201
    row = get(h).json()
    shoulder = [part for part in row["metrics"] if part["part"] == "shoulder"]
    assert len(shoulder) == 6
    assert {part["baseline_id"] for part in shoulder} == {None, baseline_a, baseline_b}
    assert all(part["measured_sec"] == 30 and part["dev_mean"] == 1.25 for part in shoulder)


def test_minute_range_is_owned_and_half_open(harness):
    h = harness
    h.clock.now = datetime(2026, 10, 2, tzinfo=UTC)
    h.account()
    items = [payload(index) for index in range(50, 54)]
    for item, at in zip(
        items,
        [
            "2026-09-30T14:59:00Z",
            "2026-09-30T15:00:00Z",
            "2026-10-01T14:59:00Z",
            "2026-10-01T15:00:00Z",
        ],
        strict=True,
    ):
        item["minute_start"] = at
    assert post(h, *items).status_code == 201
    assert get(h).json()["totals"]["minutes"] == 2


@pytest.mark.parametrize(
    "day,zone,start,end",
    [
        ("2018-11-04", "America/Sao_Paulo", "2018-11-04T03:00:00Z", "2018-11-05T02:00:00Z"),
        ("2011-12-29", "Pacific/Apia", "2011-12-29T10:00:00Z", "2011-12-30T10:00:00Z"),
        ("1919-03-31", "America/Toronto", "1919-03-31T04:30:00Z", "1919-04-01T04:00:00Z"),
    ],
)
def test_midnight_gap_and_skipped_end_boundary(harness, day, zone, start, end):
    harness.account()
    response = get(harness, date=day, timezone=zone)
    assert response.status_code == 200
    assert response.json()["start"] == start and response.json()["end"] == end


def test_subnormal_measurement_preserves_mean_and_unrepresentable_ratio(harness):
    h = harness
    h.account()
    item = payload(58)
    item.update(
        measured_sec=1e-320,
        unmeasurable_sec=60,
        present_sec=1e-320,
        background_sec=0,
        any_bad_sec=5e-7,
    )
    item["shoulder"].update(measured_sec=1e-320, bad_sec=5e-7)
    assert post(h, item).status_code == 201
    response = get(h)
    assert response.status_code == 200
    part = next(p for p in response.json()["metrics"] if p["part"] == "shoulder")
    assert part["dev_mean"] == 1.25
    assert part["bad_ratio"] is None


def test_numeric_weighted_mean_stays_inside_accepted_domain(harness):
    h = harness
    h.account()
    items = [payload(index) for index in range(50, 56)]
    for item in items:
        item.update(
            measured_sec=0.1,
            unmeasurable_sec=59.9,
            present_sec=0.1,
            background_sec=0,
            any_bad_sec=0,
        )
        item["shoulder"].update(measured_sec=0.1, bad_sec=0, dev_mean=9007199254740991)
    assert post(h, *items).status_code == 201
    response = get(h)
    assert response.status_code == 200
    part = next(p for p in response.json()["metrics"] if p["part"] == "shoulder")
    assert part["dev_mean"] == 9007199254740991


@pytest.mark.parametrize("measured,bad", [(1e-320, 4e-321), (60.0, 5e-324)])
def test_ratio_matches_emitted_float_durations_or_precision_null(harness, measured, bad):
    h = harness
    h.account()
    item = payload(59)
    item.update(
        measured_sec=measured,
        unmeasurable_sec=60 - measured,
        present_sec=measured,
        background_sec=0,
        any_bad_sec=bad,
    )
    item["shoulder"].update(measured_sec=measured, bad_sec=bad)
    assert post(h, item).status_code == 201
    response = get(h)
    assert response.status_code == 200
    part = next(p for p in response.json()["metrics"] if p["part"] == "shoulder")
    quotient = part["bad_sec"] / part["measured_sec"]
    assert part["bad_ratio"] == (None if quotient == 0 and bad > 0 else quotient)


@pytest.mark.parametrize("date", ["1867-10-18", "1867-10-19"])
def test_repeated_local_date_includes_only_matching_calendar_minutes(harness, date):
    from zoneinfo import ZoneInfo

    h = harness
    owner = h.account()
    zone = ZoneInfo("America/Anchorage")
    # The historical24h rollback creates a noncontiguous date; each stored
    # UTC minute belongs to exactly its actual local calendar date.
    base = _values(MinuteInput.model_validate(payload()))
    start = datetime(1867, 10, 17, tzinfo=UTC)
    instants = [start + timedelta(hours=index) for index in range(96)]
    with h.engine.begin() as connection:
        connection.execute(
            insert(minute_summaries),
            [
                {**base, "user_id": owner, "minute_start": instant, "created_at": h.clock.now}
                for instant in instants
            ],
        )
        connection.execute(
            insert(stretch_records),
            [
                {
                    "user_id": owner,
                    "id": f"00000000-0000-4000-8000-{index:012d}",
                    "motion_id": "fixture",
                    "protocol_version": "Fixture+V1",
                    "started_at": instant,
                    "ended_at": instant + timedelta(minutes=1),
                    "outcome": "completed",
                    "observed_ms": 0,
                    "repetitions": 0,
                    "created_at": h.clock.now,
                }
                for index, instant in enumerate(instants)
            ],
        )
    response = get(h, date=date, timezone="America/Anchorage")
    assert response.status_code == 200
    expected = sum(instant.astimezone(zone).date().isoformat() == date for instant in instants)
    assert response.json()["totals"]["minutes"] == expected
    assert response.json()["stretch"]["completed"] == expected
