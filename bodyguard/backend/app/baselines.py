"""FR-M-03/FR-R-01: immutable client-reported baselines, never a posture classifier."""

import re
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Connection, Engine, RowMapping, insert, select, text, update

from app.db import baselines, users

TOKEN_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$"
UUID_PATTERN = (
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)
Token = Annotated[str, Field(pattern=TOKEN_PATTERN, max_length=64)]


class BaselineMetric(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    method: Token
    unit: Token
    value: float = Field(ge=-9007199254740991, le=9007199254740991, allow_inf_nan=False)


class BaselineInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(pattern=UUID_PATTERN)
    client_version: Token
    neck: BaselineMetric | None
    shoulder: BaselineMetric
    trunk: BaselineMetric | None

    @field_validator("id")
    @classmethod
    def canonical_id(cls, value: str) -> str:
        return value.lower()


class BaselineOut(BaselineInput):
    created_at: datetime
    is_active: bool
    provenance: Literal["client-reported"]


def _values(payload: BaselineInput) -> dict[str, object]:
    values: dict[str, object] = {"id": payload.id, "client_version": payload.client_version}
    for name in ("neck", "shoulder", "trunk"):
        metric = getattr(payload, name)
        for field in ("method", "unit", "value"):
            values[f"{name}_{field}"] = getattr(metric, field) if metric is not None else None
    return values


def _output(row: RowMapping) -> BaselineOut:
    values = {name: row[name] for name in ("id", "client_version", "created_at", "is_active")}
    for name in ("neck", "shoulder", "trunk"):
        values[name] = (
            {field: row[f"{name}_{field}"] for field in ("method", "unit", "value")}
            if row[f"{name}_value"] is not None
            else None
        )
    values["provenance"] = "client-reported"
    return BaselineOut.model_validate(values)


def register_baselines(
    app: FastAPI,
    db: Engine,
    clock: Callable[[], datetime],
    owner: Callable[[Connection, Request, bool, bool], str],
    error_model: type[BaseModel],
    bind_read: Callable[[Request, str, str | None, str | None], None],
) -> None:
    def authenticate(connection: Connection, request: Request, writing: bool) -> str:
        connection.execute(text("SET LOCAL lock_timeout = '2s'"))
        user_id = owner(connection, request, writing, False)
        if writing:
            connection.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.baseline-owner." + user_id},
            )
        # Pin credentials across FK/commit; KEY SHARE conflicts with reset FOR UPDATE,
        # but is compatible with withdrawal's initial NO KEY UPDATE + sessions NOWAIT.
        found = connection.scalar(
            select(users.c.id)
            .where(users.c.id == user_id)
            .with_for_update(read=True, key_share=True)
        )
        if found is None or owner(connection, request, writing, True) != user_id:
            raise HTTPException(401, "로그인이 필요합니다.")
        return user_id

    def find(connection: Connection, user_id: str, baseline_id: str) -> RowMapping | None:
        return (
            connection.execute(
                select(baselines).where(
                    baselines.c.user_id == user_id, baselines.c.id == baseline_id
                )
            )
            .mappings()
            .first()
        )

    @app.get("/api/v1/baselines/active", response_model=BaselineOut | None)
    def active(
        request: Request,
        read_csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        expected_owner: Annotated[str | None, Header(alias="X-Account-ID")] = None,
    ) -> BaselineOut | None:
        with db.begin() as connection:
            user_id = authenticate(connection, request, False)
            # FR-U-04/NFR-08: bind this read to the web's original session/owner lease.
            bind_read(request, user_id, read_csrf, expected_owner)
            row = (
                connection.execute(
                    select(baselines).where(
                        baselines.c.user_id == user_id, baselines.c.is_active.is_(True)
                    )
                )
                .mappings()
                .first()
            )
            return _output(row) if row is not None else None

    @app.get(
        "/api/v1/baselines/{baseline_id}",
        response_model=BaselineOut,
        responses={404: {"model": error_model}},
    )
    def detail(
        baseline_id: str,
        request: Request,
        read_csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        expected_owner: Annotated[str | None, Header(alias="X-Account-ID")] = None,
    ) -> BaselineOut:
        with db.begin() as connection:
            user_id = authenticate(connection, request, False)
            bind_read(request, user_id, read_csrf, expected_owner)
            row = (
                find(connection, user_id, baseline_id.lower())
                if re.fullmatch(UUID_PATTERN, baseline_id)
                else None
            )
            if row is None:
                raise HTTPException(404, "기준선을 찾을 수 없습니다.")
            return _output(row)

    @app.post(
        "/api/v1/baselines",
        response_model=BaselineOut,
        status_code=201,
        responses={200: {"model": BaselineOut}, 409: {"model": error_model}},
    )
    def save(
        payload: BaselineInput,
        request: Request,
        response: Response,
        read_csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        expected_owner: Annotated[str | None, Header(alias="X-Account-ID")] = None,
    ) -> BaselineOut:
        with db.begin() as connection:
            user_id = authenticate(connection, request, True)
            # FR-U-04: even a valid proof acquired during account ABA must not write another owner.
            bind_read(request, user_id, read_csrf, expected_owner)
            values = _values(payload)
            existing = find(connection, user_id, payload.id)
            if existing is not None:
                if any(existing[name] != value for name, value in values.items()):
                    raise HTTPException(409, "같은 기준선 ID의 내용이 다릅니다.")
                response.status_code = 200
                return _output(existing)  # Never reactivate a retried historical snapshot.
            connection.execute(
                update(baselines)
                .where(baselines.c.user_id == user_id, baselines.c.is_active.is_(True))
                .values(is_active=False)
            )
            row = (
                connection.execute(
                    insert(baselines)
                    .values(user_id=user_id, created_at=clock(), is_active=True, **values)
                    .returning(*baselines.c)
                )
                .mappings()
                .one()
            )
            return _output(row)
