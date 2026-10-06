"""FR-R-01/04, FR-U-03: owned aggregate storage, never a posture correctness certificate."""

import hmac
import re
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException, Query, Request, Response
from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import (
    Connection,
    Engine,
    RowMapping,
    String,
    cast,
    delete,
    func,
    insert,
    literal,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.sql.selectable import CTE

from app.baselines import UUID_PATTERN, Token
from app.db import baselines, minute_summaries, users
from app.records import DeletedOut, DeletePeriod, DeleteProof

METRICS = ("neck", "shoulder", "trunk")
DURATIONS = (
    "coverage_sec",
    "measured_sec",
    "unmeasurable_sec",
    "present_sec",
    "background_sec",
    "any_bad_sec",
)
EPSILON = 0.000001  # Floating-point accumulation tolerance, not a clinical threshold.


def _explicit_time(value: object) -> object:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value
    ):
        parsed = datetime.fromisoformat(value)
    else:
        raise ValueError("Explicit ISO aware timestamp required")
    if parsed.utcoffset() is None:
        raise ValueError("Explicit timezone required")
    try:
        return parsed.astimezone(UTC)
    except OverflowError as error:
        raise ValueError("Unsupported UTC timestamp") from error


ExplicitTime = Annotated[AwareDatetime, Field(strict=False), BeforeValidator(_explicit_time)]


class MinuteMetric(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    method: Token
    unit: Token
    dev_mean: float | None = Field(ge=-9007199254740991, le=9007199254740991, allow_inf_nan=False)
    measured_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    bad_sec: float = Field(ge=0, le=60, allow_inf_nan=False)

    @model_validator(mode="after")
    def consistent(self) -> MinuteMetric:
        if (self.dev_mean is None) != (
            self.measured_sec == 0
        ) or self.bad_sec > self.measured_sec + EPSILON:
            raise ValueError("Inconsistent metric duration")
        if self.measured_sec == 0 and self.bad_sec != 0:
            raise ValueError("Unobserved metric cannot contain activity")
        return self


class MinuteInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    minute_start: ExplicitTime
    baseline_id: str | None = Field(pattern=UUID_PATTERN)
    client_version: Token
    coverage_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    measured_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    unmeasurable_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    present_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    background_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    any_bad_sec: float = Field(ge=0, le=60, allow_inf_nan=False)
    neck: MinuteMetric
    shoulder: MinuteMetric
    trunk: MinuteMetric

    @field_validator("baseline_id")
    @classmethod
    def canonical_baseline(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None

    @model_validator(mode="after")
    def consistent(self) -> MinuteInput:
        self.minute_start = self.minute_start.astimezone(UTC)
        if self.minute_start.second or self.minute_start.microsecond:
            raise ValueError("UTC minute boundary required")
        parts = [getattr(self, name) for name in METRICS]
        if (
            abs(self.coverage_sec - self.measured_sec - self.unmeasurable_sec - self.background_sec)
            > EPSILON
            or self.measured_sec > self.present_sec + EPSILON
            or self.present_sec > self.coverage_sec - self.background_sec + EPSILON
            or max(part.measured_sec for part in parts) > self.measured_sec + EPSILON
            or self.measured_sec > sum(part.measured_sec for part in parts) + EPSILON
            or max(part.bad_sec for part in parts) > self.any_bad_sec + EPSILON
            or self.any_bad_sec
            > min(self.measured_sec, sum(part.bad_sec for part in parts)) + EPSILON
            or self.measured_sec - self.any_bad_sec
            > sum(part.measured_sec - part.bad_sec for part in parts) + EPSILON
            or (self.baseline_id is None and (self.neck.measured_sec or self.trunk.measured_sec))
        ):
            raise ValueError("Inconsistent aggregate duration")
        return self


class MinuteOut(MinuteInput):
    created_at: datetime
    provenance: Literal["client-reported"]


class MinuteBatch(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    items: list[MinuteInput] = Field(min_length=1, max_length=60)

    @model_validator(mode="after")
    def unique(self) -> MinuteBatch:
        if len({item.minute_start for item in self.items}) != len(self.items):
            raise ValueError("Duplicate minute in batch")
        return self


class MinuteList(BaseModel):
    items: list[MinuteOut]
    has_more: bool


class SummaryPeriod(DeletePeriod):
    start: ExplicitTime
    end: ExplicitTime


class SummaryProof(DeleteProof):
    start: ExplicitTime
    end: ExplicitTime
    cutoff: ExplicitTime
    expires_at: ExplicitTime

    @model_validator(mode="after")
    def lifetime(self) -> SummaryProof:
        if self.expires_at - self.cutoff != timedelta(minutes=10):
            raise ValueError("Invalid confirmation lifetime")
        return self


class SummaryDelete(SummaryProof):
    confirmation: Literal["delete-minute-summaries"]


def _values(payload: MinuteInput) -> dict[str, object]:
    values = payload.model_dump(exclude=set(METRICS))
    for metric in METRICS:
        for field, value in getattr(payload, metric).model_dump().items():
            values[f"{metric}_{field}"] = value
    return values


def _output(row: RowMapping) -> MinuteOut:
    values = {
        name: row[name]
        for name in (*DURATIONS, "minute_start", "baseline_id", "client_version", "created_at")
    }
    for metric in METRICS:
        values[metric] = {field: row[f"{metric}_{field}"] for field in MinuteMetric.model_fields}
    values["provenance"] = "client-reported"
    values["created_at"] = row["created_at"].astimezone(UTC)
    return MinuteOut.model_validate(values)


def register_summaries(
    app: FastAPI,
    db: Engine,
    clock: Callable[[], datetime],
    owner: Callable[[Connection, Request, bool, bool], str],
    sign: Callable[[str, Request, str], str],
    error_model: type[BaseModel],
    bind_read: Callable[[Request, str, str | None, str | None], None],
) -> None:
    def authenticate(connection: Connection, request: Request, writing: bool) -> str:
        connection.execute(text("SET LOCAL lock_timeout = '2s'"))
        user_id = owner(connection, request, writing, False)
        if writing:
            connection.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.summary-owner." + user_id},
            )
        pinned = connection.scalar(
            select(users.c.id)
            .where(users.c.id == user_id)
            .with_for_update(read=True, key_share=True)
        )
        if pinned is None or owner(connection, request, writing, True) != user_id:
            raise HTTPException(401, "로그인이 필요합니다.")
        return user_id

    @app.post(
        "/api/v1/summaries/batch",
        response_model=MinuteList,
        status_code=201,
        responses={200: {"model": MinuteList}, 409: {"model": error_model}},
    )
    def save(payload: MinuteBatch, request: Request, response: Response) -> MinuteList:
        with db.begin() as connection:
            user_id = authenticate(connection, request, True)
            now = clock()
            results: list[MinuteOut] = []
            created = False
            for item in sorted(payload.items, key=lambda value: value.minute_start):
                if item.minute_start > now + timedelta(minutes=4):
                    raise HTTPException(422, "입력 형식을 확인해 주세요.")
                if item.baseline_id is not None:
                    baseline = (
                        connection.execute(
                            select(baselines).where(
                                baselines.c.user_id == user_id, baselines.c.id == item.baseline_id
                            )
                        )
                        .mappings()
                        .first()
                    )
                    if (
                        baseline is None
                        or baseline["client_version"] != item.client_version
                        or any(
                            getattr(item, name).measured_sec
                            and (
                                baseline[f"{name}_value"] is None
                                or baseline[f"{name}_method"] != getattr(item, name).method
                                or baseline[f"{name}_unit"] != getattr(item, name).unit
                            )
                            for name in METRICS
                        )
                    ):
                        raise HTTPException(422, "입력 형식을 확인해 주세요.")
                values = _values(item)
                existing = (
                    connection.execute(
                        select(minute_summaries).where(
                            minute_summaries.c.user_id == user_id,
                            minute_summaries.c.minute_start == item.minute_start,
                        )
                    )
                    .mappings()
                    .first()
                )
                if existing is not None:
                    if any(existing[name] != value for name, value in values.items()):
                        raise HTTPException(409, "같은 분의 요약 내용이 다릅니다.")
                    results.append(_output(existing))
                else:
                    row = (
                        connection.execute(
                            insert(minute_summaries)
                            .values(user_id=user_id, created_at=now, **values)
                            .returning(*minute_summaries.c)
                        )
                        .mappings()
                        .one()
                    )
                    results.append(_output(row))
                    created = True
            response.status_code = 201 if created else 200
            return MinuteList(items=results, has_more=False)

    @app.get("/api/v1/summaries", response_model=MinuteList)
    def listing(
        request: Request,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0, le=10000),
        start: ExplicitTime | None = None,
        end: ExplicitTime | None = None,
        read_csrf: str | None = Header(None, alias="X-CSRF-Token"),
        expected_owner: str | None = Header(None, alias="X-Account-ID"),
    ) -> MinuteList:
        if start is not None and end is not None and start >= end:
            raise HTTPException(422, "조회 기간을 확인해 주세요.")
        with db.begin() as connection:
            user_id = authenticate(connection, request, False)
            bind_read(request, user_id, read_csrf, expected_owner)
            query = select(minute_summaries).where(minute_summaries.c.user_id == user_id)
            if start is not None:
                query = query.where(minute_summaries.c.minute_start >= start)
            if end is not None:
                query = query.where(minute_summaries.c.minute_start < end)
            rows = (
                connection.execute(
                    query.order_by(minute_summaries.c.minute_start.desc())
                    .limit(limit + 1)
                    .offset(offset)
                )
                .mappings()
                .all()
            )
            return MinuteList(
                items=[_output(row) for row in rows[:limit]], has_more=len(rows) > limit
            )

    def deletion_scope(user_id: str, period: DeletePeriod, cutoff: datetime) -> tuple[CTE, CTE]:
        fields = [column.name for column in minute_summaries.c if column.name != "user_id"]
        targets = (
            select(*(minute_summaries.c[name] for name in fields))
            .where(
                minute_summaries.c.user_id == user_id,
                minute_summaries.c.minute_start >= period.start,
                minute_summaries.c.minute_start < period.end,
                minute_summaries.c.created_at <= cutoff,
            )
            .order_by(minute_summaries.c.minute_start)
            .with_for_update()
            .cte("summary_deletion_targets")
        )
        values = [
            func.timezone("UTC", targets.c[name])
            if name in ("minute_start", "created_at")
            else targets.c[name]
            for name in fields
        ]
        joined = func.coalesce(
            func.string_agg(
                cast(func.jsonb_build_array(*values), String),
                aggregate_order_by(literal(","), targets.c.minute_start),
            ),
            "",
        )
        scope = (
            select(
                func.count().label("count"),
                func.encode(func.sha256(func.convert_to(joined, "UTF8")), "hex").label(
                    "fingerprint"
                ),
            )
            .select_from(targets)
            .cte("summary_deletion_scope")
        )
        return targets, scope

    @app.post("/api/v1/summaries/delete-preview", response_model=SummaryProof)
    def preview(payload: SummaryPeriod, request: Request) -> SummaryProof:
        with db.begin() as connection:
            user_id = authenticate(connection, request, True)
            now = clock()
            _, scope = deletion_scope(user_id, payload, now)
            values = connection.execute(select(scope)).mappings().one()
            proof = SummaryProof(
                **payload.model_dump(),
                cutoff=now,
                expires_at=now + timedelta(minutes=10),
                count=values["count"],
                fingerprint=values["fingerprint"],
                signature="0" * 64,
            )
            proof.signature = sign(user_id, request, "minute-summaries:" + proof.signed_message())
            return proof

    @app.post(
        "/api/v1/summaries/delete",
        response_model=DeletedOut,
        responses={409: {"model": error_model}},
    )
    def remove(payload: SummaryDelete, request: Request) -> DeletedOut:
        with db.begin() as connection:
            user_id = authenticate(connection, request, True)
            if not hmac.compare_digest(
                payload.signature,
                sign(user_id, request, "minute-summaries:" + payload.signed_message()),
            ):
                raise HTTPException(403, "요청을 확인할 수 없습니다.")
            now = clock()
            if not payload.cutoff <= now < payload.expires_at:
                raise HTTPException(409, "삭제 기간을 다시 확인해 주세요.")
            targets, scope = deletion_scope(user_id, payload, payload.cutoff)
            matching = (
                select(scope.c.count)
                .where(scope.c.count == payload.count, scope.c.fingerprint == payload.fingerprint)
                .exists()
            )
            removed = (
                delete(minute_summaries)
                .where(
                    minute_summaries.c.user_id == user_id,
                    minute_summaries.c.minute_start.in_(select(targets.c.minute_start)),
                    matching,
                )
                .returning(minute_summaries.c.minute_start)
                .cte("removed_summaries")
            )
            result = (
                connection.execute(
                    select(
                        scope.c.count,
                        scope.c.fingerprint,
                        select(func.count())
                        .select_from(removed)
                        .scalar_subquery()
                        .label("deleted"),
                    )
                )
                .mappings()
                .one()
            )
            if result["count"] and (
                result["count"] != payload.count or result["fingerprint"] != payload.fingerprint
            ):
                raise HTTPException(409, "삭제 대상이 바뀌었습니다. 기간을 다시 확인해 주세요.")
            return DeletedOut(deleted=result["deleted"])
