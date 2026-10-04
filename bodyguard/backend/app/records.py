"""FR-R-03/FR-U-04: account-owned reported summaries, not correctness certificates."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import Connection, Engine, select
from sqlalchemy.dialects.postgresql import insert

from app.db import stretch_records


class StretchInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    motion_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")
    protocol_version: str = Field(pattern=r"^[a-z0-9][a-z0-9.-]{0,63}$")
    started_at: AwareDatetime = Field(strict=False)
    ended_at: AwareDatetime = Field(strict=False)
    outcome: Literal["completed", "interrupted", "skipped"]
    observed_ms: int = Field(ge=0, le=86400000)
    repetitions: int = Field(ge=0, le=10000)

    @field_validator("started_at", "ended_at", mode="before")
    @classmethod
    def timestamp_format(cls, value: object) -> object:
        if not isinstance(value, (str, datetime)):
            raise ValueError("Timestamp must be an explicit aware datetime")
        return value

    @model_validator(mode="after")
    def consistent(self) -> StretchInput:
        self.started_at = self.started_at.astimezone(UTC)
        self.ended_at = self.ended_at.astimezone(UTC)
        wall_ms = (self.ended_at - self.started_at).total_seconds() * 1000
        if wall_ms < self.observed_ms or wall_ms < 0 or wall_ms > 86400000:
            raise ValueError("Inconsistent summary duration")
        if self.outcome == "skipped" and (self.observed_ms or self.repetitions):
            raise ValueError("Skipped summary cannot contain performed activity")
        return self


class StretchOut(StretchInput):
    created_at: datetime
    provenance: Literal["client-reported"] = "client-reported"


class StretchList(BaseModel):
    items: list[StretchOut]
    has_more: bool


def register_records(
    app: FastAPI,
    db: Engine,
    clock: Callable[[], datetime],
    owner: Callable[[Connection, Request, bool], str],
) -> None:
    @app.post("/api/v1/records/stretch", response_model=StretchOut, status_code=201)
    def save(payload: StretchInput, request: Request, response: Response) -> StretchOut:
        with db.begin() as connection:
            user_id = owner(connection, request, True)
            now = clock()
            if payload.ended_at > now + timedelta(minutes=5):
                raise HTTPException(422, "입력 형식을 확인해 주세요.")
            values = payload.model_dump()
            result = connection.execute(
                insert(stretch_records)
                .values(**values, user_id=user_id, created_at=now)
                .on_conflict_do_nothing(index_elements=["user_id", "id"])
                .returning(stretch_records.c.id)
            ).first()
            row = (
                connection.execute(
                    select(stretch_records).where(
                        stretch_records.c.user_id == user_id,
                        stretch_records.c.id == payload.id,
                    )
                )
                .mappings()
                .one()
            )
            if result is None:
                if any(row[name] != value for name, value in values.items()):
                    raise HTTPException(409, "같은 기록의 내용이 다릅니다.")
                response.status_code = 200
            return StretchOut(**{key: row[key] for key in [*values, "created_at"]})

    @app.get("/api/v1/records/stretch", response_model=StretchList)
    def listing(
        request: Request,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=10000),
        start: AwareDatetime | None = None,
        end: AwareDatetime | None = None,
    ) -> StretchList:
        with db.begin() as connection:
            user_id = owner(connection, request, False)
            if start is not None and end is not None and start >= end:
                raise HTTPException(422, "입력 형식을 확인해 주세요.")
            query = select(stretch_records).where(stretch_records.c.user_id == user_id)
            if start is not None:
                query = query.where(stretch_records.c.ended_at >= start)
            if end is not None:
                query = query.where(stretch_records.c.ended_at < end)
            rows = (
                connection.execute(
                    query.order_by(
                        stretch_records.c.ended_at.desc(),
                        stretch_records.c.id.desc(),
                    )
                    .limit(limit + 1)
                    .offset(offset)
                )
                .mappings()
                .all()
            )
            return StretchList(
                items=[
                    StretchOut(
                        **{
                            name: row[name]
                            for name in StretchOut.model_fields
                            if name != "provenance"
                        }
                    )
                    for row in rows[:limit]
                ],
                has_more=len(rows) > limit,
            )

    @app.get("/api/v1/records/stretch/{record_id}", response_model=StretchOut)
    def detail(record_id: str, request: Request) -> StretchOut:
        with db.begin() as connection:
            user_id = owner(connection, request, False)
            row = (
                connection.execute(
                    select(stretch_records).where(
                        stretch_records.c.user_id == user_id,
                        stretch_records.c.id == record_id,
                    )
                )
                .mappings()
                .first()
            )
            if row is None:
                raise HTTPException(404, "기록을 찾을 수 없습니다.")
            return StretchOut(
                **{name: row[name] for name in StretchOut.model_fields if name != "provenance"}
            )
