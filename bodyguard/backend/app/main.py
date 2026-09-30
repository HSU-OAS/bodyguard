"""FR-U-02/03/04: email account and server-cookie sessions."""

import asyncio
import hmac
import math
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from uuid import uuid4

import aiosmtplib
from email_validator import EmailNotValidError, validate_email
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from sqlalchemy import Connection, Engine, RowMapping, create_engine, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings
from app.db import challenges, limits, sessions, users
from app.security import cleanup, code, digest, keyed, passwords, quota, token


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    email: str = Field(max_length=320)
    password: SecretStr = Field(min_length=15, max_length=128)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        try:
            return str(validate_email(value.strip(), check_deliverability=False).normalized).lower()
        except EmailNotValidError:
            raise ValueError("Invalid email") from None


class ChallengeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    challenge_id: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


class Verification(ChallengeInput):
    code: str = Field(pattern=r"^[0-9]{6}$")


class UserOut(BaseModel):
    id: str
    email: str


class AuthOut(UserOut):
    csrf_token: str


class CsrfOut(BaseModel):
    csrf_token: str


class ChallengeOut(BaseModel):
    challenge_id: str


class ErrorOut(BaseModel):
    detail: str


def utcnow() -> datetime:
    return datetime.now(UTC)


def smtp_mail(settings: Settings, email: str, value: str) -> None:
    if not settings.mail_configured:
        raise RuntimeError("Mail unavailable")
    assert settings.smtp_username is not None and settings.smtp_password is not None
    message = EmailMessage()
    message["From"] = settings.smtp_username.get_secret_value()
    message["To"] = email
    message["Subject"] = "BODYGUARD 이메일 인증"
    message.set_content(f"인증 코드: {value}\n10분 이내에 가입 화면에서 입력해 주세요.")
    # ponytail: bounded synchronous delivery; durable outbox when provider throughput requires it.
    asyncio.run(
        aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            timeout=10,
            username=settings.smtp_username.get_secret_value(),
            password=settings.smtp_password.get_secret_value(),
        )
    )


def create_app(
    settings: Settings | None = None,
    engine: Engine | None = None,
    mail: Callable[[str, str], None] | None = None,
    clock: Callable[[], datetime] | None = None,
) -> FastAPI:
    config = settings or Settings.from_environment()
    if config.environment != "test" and (mail is not None or clock is not None):
        raise RuntimeError("Test dependencies cannot launch a non-test server")
    db = engine or create_engine(
        config.database_url.get_secret_value(), hide_parameters=True, pool_pre_ping=True
    )
    send = mail or (lambda address, value: smtp_mail(config, address, value))
    now_fn = clock or utcnow
    key = config.security_key.get_secret_value()
    dummy_hash = passwords.hash(token())
    app = FastAPI(
        title="BODYGUARD 계정 API",
        docs_url=None if config.environment == "production" else "/docs",
        redoc_url=None,
        openapi_url=None if config.environment == "production" else "/openapi.json",
        responses={status: {"model": ErrorOut} for status in (400, 401, 403, 422, 429, 503)},
    )

    def failure(status: int, message: str, retry: int = 0) -> Response:
        return JSONResponse(
            {"detail": message},
            status_code=status,
            headers={"Retry-After": str(retry)} if retry else None,
        )

    def session(
        connection: Connection, request: Request, now: datetime, *, locked: bool = False
    ) -> RowMapping | None:
        raw = request.cookies.get(config.cookie_name, "")
        if len(raw) != 43:
            return None
        query = select(sessions).where(sessions.c.token_hash == digest(raw))
        row = connection.execute(query.with_for_update() if locked else query).mappings().first()
        if locked:
            now = now_fn()  # A queued transaction cannot use a pre-lock expiry timestamp.
        if not row or row["revoked_at"] is not None or row["expires_at"] <= now:
            return None
        if row["user_id"] and row["last_seen_at"] + timedelta(minutes=30) <= now:
            return None
        return row

    def protect(connection: Connection, request: Request, now: datetime) -> RowMapping | None:
        if request.headers.get("Origin") != config.origin:
            raise HTTPException(403, "요청을 확인할 수 없습니다.")
        row = session(connection, request, now, locked=True)
        # Expired/missing logout can only clear the cookie, not mutate business state.
        if request.url.path == "/api/v1/auth/logout" and row is None:
            return None
        supplied = request.headers.get("X-CSRF-Token", "")
        expected = keyed(key, "csrf", request.cookies.get(config.cookie_name, ""))
        if (
            row is None
            or len(supplied) != 64
            or not supplied.isascii()
            or not hmac.compare_digest(supplied, expected)
        ):
            raise HTTPException(403, "요청을 확인할 수 없습니다.")
        return row

    def preflight(request: Request) -> None:
        with db.begin() as connection:
            protect(connection, request, now_fn())

    @app.middleware("http")
    async def boundaries(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            if request.method == "POST":
                await asyncio.to_thread(preflight, request)
            response = await call_next(request)
        except HTTPException as exc:
            response = failure(exc.status_code, str(exc.detail))
        except SQLAlchemyError:
            response = failure(503, "서비스 연결을 다시 시도해 주세요.")
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> Response:
        # Pydantic's default includes input/password/code and arbitrary context: never echo it.
        return failure(422, "입력 형식을 확인해 주세요.")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> Response:
        response = failure(exc.status_code, str(exc.detail))
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError) -> Response:
        return failure(503, "서비스 연결을 다시 시도해 주세요.")

    def new_session(
        connection: Connection, response: Response, now: datetime, user_id: str | None
    ) -> str:
        raw = token()
        seconds = 8 * 3600 if user_id else 600
        connection.execute(
            insert(sessions).values(
                token_hash=digest(raw),
                user_id=user_id,
                created_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(seconds=seconds),
                revoked_at=None,
            )
        )
        response.set_cookie(
            config.cookie_name,
            raw,
            max_age=seconds,
            httponly=True,
            secure=config.secure_cookie,
            samesite="lax",
            path="/",
        )
        return keyed(key, "csrf", raw)

    def rotate(
        connection: Connection, response: Response, row: RowMapping, now: datetime, user_id: str
    ) -> str:
        connection.execute(
            update(sessions)
            .where(sessions.c.token_hash == row["token_hash"])
            .values(revoked_at=now)
        )
        return new_session(connection, response, now, user_id)

    def mail_keys(request: Request, email: str) -> list[tuple[str, int]]:
        # Transport peer only; ASGI server must use --no-proxy-headers (README).
        peer = request.client.host if request.client else "unknown"
        return [
            (keyed(key, "mail-email", email), 5),
            (keyed(key, "mail-ip", peer), 20),
        ]

    @app.get("/api/v1/auth/csrf", response_model=CsrfOut)
    def csrf(request: Request, response: Response) -> dict[str, str]:
        now = now_fn()
        with db.begin() as connection:
            cleanup(connection, now)
            row = session(connection, request, now)
            if row is None:
                peer = request.client.host if request.client else "unknown"
                retry = quota(
                    connection,
                    [(keyed(key, "anonymous-ip", peer), 100)],
                    now,
                    timedelta(minutes=1),
                    consume=True,
                )
                if retry:
                    raise HTTPException(
                        429, "잠시 후 다시 시도해 주세요.", headers={"Retry-After": str(retry)}
                    )
                value = new_session(connection, response, now, None)
            else:
                value = keyed(key, "csrf", request.cookies[config.cookie_name])
            return {"csrf_token": value}

    @app.post("/api/v1/auth/signup", status_code=202, response_model=ChallengeOut)
    def signup(payload: Credentials, request: Request) -> Response:
        now = now_fn()
        with db.begin() as connection:
            protect(connection, request, now)
            retry = quota(
                connection, mail_keys(request, payload.email), now, timedelta(hours=1), consume=True
            )
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
            challenge, value = token(), code()
            connection.execute(
                insert(challenges).values(
                    id=challenge,
                    email=payload.email,
                    password_hash=passwords.hash(payload.password.get_secret_value()),
                    code_hash=None,
                    expires_at=now + timedelta(minutes=10),
                    attempts=0,
                    sent_at=now,
                    used_at=None,
                )
            )
            try:
                # Same path/format/delivery for existing email; never replace the account.
                send(payload.email, value)
            except Exception:
                return failure(503, "메일을 보내지 못했습니다. 다시 시도해 주세요.")
            connection.execute(
                update(challenges)
                .where(challenges.c.id == challenge)
                .values(code_hash=keyed(key, "signup-code", challenge + ":" + value))
            )
            return JSONResponse({"challenge_id": challenge}, status_code=202)

    @app.post("/api/v1/auth/verify", status_code=201, response_model=AuthOut)
    def verify(
        payload: Verification, request: Request, response: Response
    ) -> Response | dict[str, str]:
        now = now_fn()
        with db.begin() as connection:
            old = protect(connection, request, now)
            assert old is not None
            row = (
                connection.execute(
                    select(challenges)
                    .where(challenges.c.id == payload.challenge_id)
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            now = now_fn()
            protect(connection, request, now)
            if (
                not row
                or row["used_at"] is not None
                or row["expires_at"] <= now
                or row["attempts"] >= 5
                or not row["code_hash"]
            ):
                return failure(400, "인증 코드를 다시 확인해 주세요.")
            expected = keyed(key, "signup-code", payload.challenge_id + ":" + payload.code)
            if not hmac.compare_digest(expected, row["code_hash"]):
                connection.execute(
                    update(challenges)
                    .where(challenges.c.id == row["id"])
                    .values(attempts=challenges.c.attempts + 1)
                )
                return failure(400, "인증 코드를 다시 확인해 주세요.")
            # Email uniqueness is resolved by PG, including independent challenge races.
            user_id = str(uuid4())
            created = connection.execute(
                insert(users)
                .values(
                    id=user_id,
                    email=row["email"],
                    password_hash=row["password_hash"],
                    email_verified_at=now,
                    created_at=now,
                )
                .on_conflict_do_nothing(index_elements=[users.c.email])
                .returning(users.c.id)
            ).scalar()
            connection.execute(
                update(challenges)
                .where(challenges.c.id == row["id"])
                .values(used_at=now, code_hash=None)
            )
            if created is None:
                return failure(400, "인증 코드를 다시 확인해 주세요.")
            csrf_token = rotate(connection, response, old, now, user_id)
            return {"id": user_id, "email": row["email"], "csrf_token": csrf_token}

    @app.post("/api/v1/auth/resend", status_code=202)
    def resend(payload: ChallengeInput, request: Request) -> Response:
        now = now_fn()
        with db.begin() as connection:
            protect(connection, request, now)
            row = (
                connection.execute(
                    select(challenges)
                    .where(challenges.c.id == payload.challenge_id)
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            now = now_fn()
            protect(connection, request, now)
            if not row or row["used_at"] is not None or row["expires_at"] <= now:
                return failure(400, "가입을 다시 시작해 주세요.")
            wait = math.ceil((row["sent_at"] + timedelta(seconds=60) - now).total_seconds())
            if wait > 0:
                return failure(429, "잠시 후 다시 시도해 주세요.", wait)
            retry = quota(
                connection, mail_keys(request, row["email"]), now, timedelta(hours=1), consume=True
            )
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
            connection.execute(
                update(challenges)
                .where(challenges.c.id == row["id"])
                .values(
                    code_hash=None, attempts=0, sent_at=now, expires_at=now + timedelta(minutes=10)
                )
            )
            try:
                # FR-U-03: do not randomly reissue the immediately revoked value.
                for _ in range(8):
                    value = code()
                    candidate = keyed(key, "signup-code", row["id"] + ":" + value)
                    if candidate != row["code_hash"]:
                        break
                else:
                    return failure(503, "메일을 보내지 못했습니다. 다시 시도해 주세요.")
                send(row["email"], value)
            except Exception:
                return failure(503, "메일을 보내지 못했습니다. 다시 시도해 주세요.")
            connection.execute(
                update(challenges)
                .where(challenges.c.id == row["id"])
                .values(code_hash=keyed(key, "signup-code", row["id"] + ":" + value))
            )
            return Response(status_code=202)

    @app.post("/api/v1/auth/login", response_model=AuthOut)
    def login(
        payload: Credentials, request: Request, response: Response
    ) -> Response | dict[str, str]:
        now = now_fn()
        peer = request.client.host if request.client else "unknown"
        keys = [
            (keyed(key, "login-email", payload.email), 10),
            (keyed(key, "login-ip", peer), 30),
        ]
        with db.begin() as connection:
            old = protect(connection, request, now)
            assert old is not None
            retry = quota(connection, keys, now, timedelta(minutes=15), consume=False)
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
            user = (
                connection.execute(select(users).where(users.c.email == payload.email))
                .mappings()
                .first()
            )
            valid = passwords.verify(
                payload.password.get_secret_value(), user["password_hash"] if user else dummy_hash
            )
            if not valid or user is None:
                for k, _ in keys:
                    connection.execute(
                        update(limits)
                        .where(limits.c.key_hash == k)
                        .values(count=limits.c.count + 1)
                    )
                return failure(401, "이메일 또는 비밀번호를 확인해 주세요.")
            now = now_fn()
            protect(connection, request, now)
            csrf_token = rotate(connection, response, old, now, user["id"])
            return {"id": user["id"], "email": user["email"], "csrf_token": csrf_token}

    @app.get("/api/v1/me", response_model=UserOut)
    def me(request: Request) -> dict[str, str]:
        now = now_fn()
        with db.begin() as connection:
            row = session(connection, request, now, locked=True)
            if row is None or not row["user_id"]:
                raise HTTPException(401, "로그인이 필요합니다.")
            user = (
                connection.execute(select(users).where(users.c.id == row["user_id"]))
                .mappings()
                .one()
            )
            connection.execute(
                update(sessions)
                .where(sessions.c.token_hash == row["token_hash"])
                .values(last_seen_at=now)
            )
            return {"id": user["id"], "email": user["email"]}

    @app.post("/api/v1/auth/logout", status_code=204)
    def logout(request: Request) -> Response:
        with db.begin() as connection:
            row = protect(connection, request, now_fn())
            if row is not None:
                connection.execute(
                    update(sessions)
                    .where(sessions.c.token_hash == row["token_hash"])
                    .values(revoked_at=now_fn())
                )
        response = Response(status_code=204)
        response.delete_cookie(
            config.cookie_name, httponly=True, secure=config.secure_cookie, samesite="lax", path="/"
        )
        return response

    return app
