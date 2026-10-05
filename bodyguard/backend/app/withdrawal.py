"""FR-U-05: explicit self-withdrawal, never a camera or correctness certificate."""

import hmac
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from sqlalchemy import Connection, Engine, RowMapping, delete, select, update
from sqlalchemy.dialects.postgresql import insert

from app.db import challenges, limits, users, withdrawals
from app.security import code, keyed, quota, token


class WithdrawalStart(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class WithdrawalChallenge(BaseModel):
    challenge_id: str


class WithdrawalConfirm(WithdrawalStart):
    challenge_id: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    code: SecretStr
    confirmation: Literal["delete-my-account"]

    @field_validator("code")
    @classmethod
    def valid_code(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) != 6 or not raw.isascii() or not raw.isdigit():
            raise ValueError("Invalid withdrawal code")
        return value


def register_withdrawal(
    app: FastAPI,
    db: Engine,
    clock: Callable[[], datetime],
    key: str,
    owner: Callable[[Connection, Request], tuple[RowMapping, str]],
    mail: Callable[[str, str], None],
    mail_keys: Callable[[Request, str], list[tuple[str, int]]],
    clear_cookie: Callable[[Response], None],
) -> None:
    def failure(status: int, message: str, retry: int = 0) -> Response:
        return JSONResponse(
            {"detail": message},
            status_code=status,
            headers={"Retry-After": str(retry)} if retry else None,
        )

    @app.post("/api/v1/me/delete/start", status_code=202, response_model=WithdrawalChallenge)
    def start(payload: WithdrawalStart, request: Request) -> Response:
        with db.begin() as connection:
            user, session_hash = owner(connection, request)
            now = clock()
            retry = quota(
                connection,
                mail_keys(request, user["email"]),
                now,
                timedelta(hours=1),
                consume=True,
            )
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
            raw, value = token(), code()
            hashed = keyed(key, "withdrawal-challenge", raw)
            values = {
                "challenge_hash": hashed,
                "session_hash": session_hash,
                "credentials_version": user["credentials_version"],
                "code_hash": None,
                "created_at": now,
                "expires_at": now + timedelta(minutes=10),
                "attempts": 0,
            }
            connection.execute(
                insert(withdrawals)
                .values(user_id=user["id"], **values)
                .on_conflict_do_update(index_elements=[withdrawals.c.user_id], set_=values)
            )
            try:
                mail(user["email"], value)
            except Exception:
                # FR-U-05: commit the revoked previous proof and quota, not a usable code.
                return failure(503, "탈퇴 확인 메일을 보내지 못했습니다. 다시 시도해 주세요.")
            connection.execute(
                update(withdrawals)
                .where(withdrawals.c.user_id == user["id"])
                .values(code_hash=keyed(key, "withdrawal-code", raw + ":" + value))
            )
        return JSONResponse({"challenge_id": raw}, status_code=202)

    @app.post("/api/v1/me/delete/confirm", status_code=204)
    def confirm(payload: WithdrawalConfirm, request: Request) -> Response:
        with db.begin() as connection:
            user, session_hash = owner(connection, request)
            proof = (
                connection.execute(
                    select(withdrawals).where(withdrawals.c.user_id == user["id"]).with_for_update()
                )
                .mappings()
                .first()
            )
            now = clock()
            if (
                not proof
                or proof["challenge_hash"]
                != keyed(key, "withdrawal-challenge", payload.challenge_id)
                or proof["session_hash"] != session_hash
                or proof["credentials_version"] != user["credentials_version"]
                or now < proof["created_at"]
                or proof["expires_at"] <= now
                or proof["attempts"] >= 5
                or not proof["code_hash"]
            ):
                return failure(400, "탈퇴 확인 코드를 다시 요청해 주세요.")
            expected = keyed(
                key, "withdrawal-code", payload.challenge_id + ":" + payload.code.get_secret_value()
            )
            if not hmac.compare_digest(expected, proof["code_hash"]):
                connection.execute(
                    update(withdrawals)
                    .where(withdrawals.c.user_id == user["id"])
                    .values(attempts=withdrawals.c.attempts + 1)
                )
                return failure(400, "탈퇴 확인 코드를 다시 확인해 주세요.")
            # FR-U-05: NOWAIT avoids a verification holding a challenge while waiting on user.
            connection.execute(
                select(challenges.c.id)
                .where(challenges.c.email == user["email"])
                .order_by(challenges.c.id)
                .with_for_update(nowait=True)
            ).all()
            # Account/session/record/reset/Google/withdrawal cascades are one transaction.
            connection.execute(delete(users).where(users.c.id == user["id"]))
            # Shared IP protection survives. Email-specific state is removed after cascade.
            email_keys = [
                keyed(key, purpose, user["email"]) for purpose in ("mail-email", "login-email")
            ]
            connection.execute(
                select(limits.c.key_hash)
                .where(limits.c.key_hash.in_(email_keys))
                .order_by(limits.c.key_hash)
                .with_for_update(nowait=True)
            ).all()
            # Catch rows created during the initial snapshot before DELETE may wait on them.
            connection.execute(
                select(challenges.c.id)
                .where(challenges.c.email == user["email"])
                .order_by(challenges.c.id)
                .with_for_update(nowait=True)
            ).all()
            connection.execute(delete(challenges).where(challenges.c.email == user["email"]))
            connection.execute(delete(limits).where(limits.c.key_hash.in_(email_keys)))
        response = Response(status_code=204)
        clear_cookie(response)
        return response
