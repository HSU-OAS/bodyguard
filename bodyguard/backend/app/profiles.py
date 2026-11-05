"""FR-U-04/05: optional account-owned profile; never a diagnosis or recommendation input."""

from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Connection, Engine, select, update
from sqlalchemy.dialects.postgresql import insert

from app.db import user_profiles


class ProfileFields(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    nickname: str | None = Field(default=None, min_length=1, max_length=60)
    age: int | None = Field(default=None, ge=0, le=150)
    height_cm: float | None = Field(default=None, gt=0, le=1000)
    weight_kg: float | None = Field(default=None, gt=0, le=1000)
    gender: Literal["male", "female"] | None = None

    @field_validator("nickname")
    @classmethod
    def clean_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value or any(ord(char) < 32 or 127 <= ord(char) < 160 for char in value):
            raise ValueError("Invalid nickname")
        return value


class ProfileWrite(ProfileFields):
    revision: int = Field(ge=0, le=2147483646)


class ProfileOut(ProfileFields):
    revision: int = Field(ge=0, le=2147483647)


def register_profiles(
    app: FastAPI,
    db: Engine,
    owner: Callable[[Connection, Request, bool], str],
    bind: Callable[[Request, str, str | None, str | None], None],
) -> None:
    fields = [user_profiles.c[name] for name in ProfileOut.model_fields]

    def require_binding(
        request: Request, user_id: str, csrf: str | None, account: str | None
    ) -> None:
        # A profile is sensitive: unlike older endpoints, both binding headers are required.
        if csrf is None or account is None:
            raise HTTPException(403, "요청을 확인할 수 없습니다.")
        bind(request, user_id, csrf, account)

    @app.get("/api/v1/profile", response_model=ProfileOut)
    def read_profile(
        request: Request,
        csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        account: Annotated[str | None, Header(alias="X-Account-ID")] = None,
    ) -> ProfileOut:
        with db.begin() as connection:
            user_id = owner(connection, request, False)
            require_binding(request, user_id, csrf, account)
            row = (
                connection.execute(select(*fields).where(user_profiles.c.user_id == user_id))
                .mappings()
                .first()
            )
            return ProfileOut.model_validate(dict(row)) if row else ProfileOut(revision=0)

    @app.post("/api/v1/profile", response_model=ProfileOut)
    def save_profile(
        payload: ProfileWrite,
        request: Request,
        csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        account: Annotated[str | None, Header(alias="X-Account-ID")] = None,
    ) -> ProfileOut:
        with db.begin() as connection:
            user_id = owner(connection, request, True)
            require_binding(request, user_id, csrf, account)
            values = payload.model_dump(exclude={"revision"})
            if payload.revision == 0:
                statement = (
                    insert(user_profiles)
                    .values(user_id=user_id, revision=1, **values)
                    .on_conflict_do_nothing(index_elements=[user_profiles.c.user_id])
                    .returning(*fields)
                )
                row = connection.execute(statement).mappings().first()
            else:
                updated = (
                    update(user_profiles)
                    .where(
                        user_profiles.c.user_id == user_id,
                        user_profiles.c.revision == payload.revision,
                    )
                    .values(revision=payload.revision + 1, **values)
                    .returning(*fields)
                )
                row = connection.execute(updated).mappings().first()
            if row is None:
                raise HTTPException(409, "기본 정보가 변경되었습니다. 다시 불러와 주세요.")
            return ProfileOut.model_validate(dict(row))
