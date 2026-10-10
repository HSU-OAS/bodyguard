"""FR-R-03/06: one owned SQL snapshot; not a clinical correctness certificate."""

import re
from collections.abc import Callable
from datetime import UTC, datetime, time, timedelta
from datetime import date as CalendarDate
from math import isfinite
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Connection, Engine, text

from app.baselines import UUID_PATTERN, Token

Period = Literal["day", "week"]
Duration = float


class DashboardTotals(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    minutes: int = Field(ge=0)
    coverage_sec: Duration = Field(ge=0)
    measured_sec: Duration = Field(ge=0)
    unmeasurable_sec: Duration = Field(ge=0)
    present_sec: Duration = Field(ge=0)
    background_sec: Duration = Field(ge=0)
    any_bad_sec: Duration = Field(ge=0)


class DashboardMetric(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    part: Literal["neck", "shoulder", "trunk"]
    baseline_id: str | None = Field(pattern=UUID_PATTERN)
    client_version: Token
    method: Token
    unit: Token
    measured_sec: Duration = Field(ge=0)
    bad_sec: Duration = Field(ge=0)
    dev_mean: float | None
    bad_ratio: float | None


def _ratio(bad_sec: float, measured_sec: float) -> float | None:
    # Use the same emitted float durations as the client, not their shortened
    # decimal strings. Preserve overflow/positive underflow as precision-null.
    if measured_sec == 0:
        return None
    quotient = bad_sec / measured_sec
    return quotient if isfinite(quotient) and (quotient != 0 or bad_sec == 0) else None


class DashboardStretch(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    completed: int = Field(ge=0)
    interrupted: int = Field(ge=0)
    skipped: int = Field(ge=0)


class DashboardOut(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    date: str
    period: Period
    timezone: str
    local_start: str
    local_end: str
    start: datetime
    end: datetime
    totals: DashboardTotals
    metrics: list[DashboardMetric]
    stretch: DashboardStretch
    notifications: None
    provenance: Literal["client-reported"]


def _boundary(day: CalendarDate, zone: ZoneInfo, *, latest: bool = False) -> datetime:
    candidate = datetime.combine(day, time(), zone).replace(fold=int(latest)).astimezone(UTC)
    if candidate.astimezone(zone).replace(tzinfo=None) == datetime.combine(day, time()):
        return candidate
    # Midnight can be inside a gap starting on the previous date; find the first real instant.
    low = int((candidate - timedelta(days=2)).timestamp())
    high = int((candidate + timedelta(days=2)).timestamp())
    while low < high:
        mid = (low + high) // 2
        if datetime.fromtimestamp(mid, UTC).astimezone(zone).date() < day:
            low = mid + 1
        else:
            high = mid
    return datetime.fromtimestamp(low, UTC)


def calendar_range(day: str, period: Period, timezone: str) -> tuple[str, str, datetime, datetime]:
    """Calendar boundaries, never fixed 24h; reject a wholly skipped selected date."""
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day):
            raise ValueError("Invalid day")
        selected = CalendarDate.fromisoformat(day)
        zone = ZoneInfo(timezone)
        # A wholly skipped local day must not silently select another date.
        selected_start = _boundary(selected, zone)
        if selected_start.astimezone(zone).date() != selected:
            raise ValueError("Nonexistent local day")
        local_start = selected - timedelta(days=selected.weekday() if period == "week" else 0)
        local_end = local_start + timedelta(days=7 if period == "week" else 1)
        start = _boundary(local_start, zone)
        # Enclose both occurrences of a repeated date. SQL also checks the local
        # calendar date so earlier next-day intervals do not enter this period.
        end = _boundary(local_end, zone, latest=True)
        if start >= end:
            raise ValueError("Empty period")
        return local_start.isoformat(), local_end.isoformat(), start, end
    except (ValueError, OverflowError, OSError, ZoneInfoNotFoundError) as error:
        raise HTTPException(422, "날짜와 시간대를 확인해 주세요.") from error


# FR-R-03: parameters are bound, all totals/groups/counts use the same MVCC
# snapshot. No pagination or materialized raw-row transfer to the application.
_DURATIONS = (
    "coverage_sec",
    "measured_sec",
    "unmeasurable_sec",
    "present_sec",
    "background_sec",
    "any_bad_sec",
)
_PARTS = ("neck", "shoulder", "trunk")
_TOTALS = ", ".join(f"coalesce(sum({name}), 0) AS {name}" for name in _DURATIONS)
_ROWS = " UNION ALL ".join(
    f"SELECT '{part}' AS part, baseline_id, client_version, {part}_method AS method, "
    f"{part}_unit AS unit, {part}_measured_sec AS measured_sec, {part}_bad_sec AS bad_sec, "
    f"{part}_dev_mean AS dev_mean FROM owned_minutes"
    for part in _PARTS
)
_QUERY = text(f"""
WITH owned_minutes AS (
    SELECT * FROM minute_summaries
    WHERE user_id = :owner AND minute_start >= :start AND minute_start < :end
      AND (minute_start AT TIME ZONE :timezone)::date >= CAST(:local_start AS date)
      AND (minute_start AT TIME ZONE :timezone)::date < CAST(:local_end AS date)
), totals AS (
    SELECT count(*) AS minutes, {_TOTALS} FROM owned_minutes
), metric_rows AS ({_ROWS}), metrics AS (
    SELECT part, baseline_id, client_version, method, unit,
      sum(measured_sec) AS measured_sec, sum(bad_sec) AS bad_sec,
      sum(dev_mean::text::numeric * measured_sec::text::numeric)
        / nullif(sum(measured_sec::text::numeric), 0) AS dev_mean
    FROM metric_rows GROUP BY part, baseline_id, client_version, method, unit
), stretches AS (
    SELECT count(*) FILTER (WHERE outcome = 'completed') AS completed,
      count(*) FILTER (WHERE outcome = 'interrupted') AS interrupted,
      count(*) FILTER (WHERE outcome = 'skipped') AS skipped
    FROM stretch_records WHERE user_id = :owner AND started_at >= :start AND started_at < :end
      AND (started_at AT TIME ZONE :timezone)::date >= CAST(:local_start AS date)
      AND (started_at AT TIME ZONE :timezone)::date < CAST(:local_end AS date)
)
SELECT (SELECT to_jsonb(totals) FROM totals) AS totals,
    coalesce((SELECT jsonb_agg(to_jsonb(metrics) ORDER BY part, baseline_id NULLS FIRST,
       client_version, method, unit) FROM metrics), '[]'::jsonb) AS metrics,
    (SELECT to_jsonb(stretches) FROM stretches) AS stretch
""")


def register_dashboard(
    app: FastAPI,
    db: Engine,
    authenticate: Callable[[Connection, Request, bool], str],
    bind_read: Callable[[Request, str, str | None, str | None], None],
) -> None:
    @app.get("/api/v1/records/dashboard", response_model=DashboardOut)
    def read(
        request: Request,
        date: str,
        period: Period,
        timezone: str,
        read_csrf: str | None = Header(None, alias="X-CSRF-Token"),
        expected_owner: str | None = Header(None, alias="X-Account-ID"),
    ) -> DashboardOut:
        local_start, local_end, start, end = calendar_range(date, period, timezone)
        with db.begin() as connection:
            owner = authenticate(connection, request, False)
            bind_read(request, owner, read_csrf, expected_owner)
            row = (
                connection.execute(
                    _QUERY,
                    {
                        "owner": owner,
                        "start": start,
                        "end": end,
                        "timezone": timezone,
                        "local_start": local_start,
                        "local_end": local_end,
                    },
                )
                .mappings()
                .one()
            )
            return DashboardOut(
                date=date,
                period=period,
                timezone=timezone,
                local_start=local_start,
                local_end=local_end,
                start=start,
                end=end,
                totals=row["totals"],
                metrics=[
                    DashboardMetric(
                        **metric, bad_ratio=_ratio(metric["bad_sec"], metric["measured_sec"])
                    )
                    for metric in row["metrics"]
                ],
                stretch=row["stretch"],
                notifications=None,
                provenance="client-reported",
            )
