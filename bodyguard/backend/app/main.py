"""FR-U-01~04: Google/email accounts and server-cookie sessions."""

import asyncio
import hmac
import logging
import math
import re
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from http.cookies import SimpleCookie
from uuid import uuid4

import aiosmtplib
import httpx2
from authlib.integrations.starlette_client import OAuth  # type: ignore[import-untyped]
from email_validator import EmailNotValidError, validate_email
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from sqlalchemy import Connection, Engine, RowMapping, create_engine, delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings
from app.db import challenges, google_flows, limits, resets, sessions, users
from app.security import cleanup, code, digest, keyed, passwords, quota, token


class EmailInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        try:
            return str(validate_email(value.strip(), check_deliverability=False).normalized).lower()
        except EmailNotValidError:
            raise ValueError("Invalid email") from None


class Credentials(EmailInput):
    password: SecretStr = Field(min_length=15, max_length=128)


class ResetInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    token: SecretStr
    password: SecretStr = Field(min_length=15, max_length=128)

    @field_validator("token")
    @classmethod
    def valid_token(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if (
            len(raw) != 43
            or not raw.isascii()
            or not all(char.isalnum() or char in "_-" for char in raw)
        ):
            raise ValueError("Invalid token")
        return value


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


class GoogleStatusOut(BaseModel):
    configured: bool


class ChallengeOut(BaseModel):
    challenge_id: str


class ErrorOut(BaseModel):
    detail: str


def utcnow() -> datetime:
    return datetime.now(UTC)


def smtp_mail(settings: Settings, email: str, value: str, *, reset: bool = False) -> None:
    if not settings.mail_configured:
        raise RuntimeError("Mail unavailable")
    assert settings.smtp_username is not None and settings.smtp_password is not None
    message = EmailMessage()
    message["From"] = settings.smtp_username.get_secret_value()
    message["To"] = email
    message["Subject"] = "BODYGUARD 비밀번호 재설정" if reset else "BODYGUARD 이메일 인증"
    message.set_content(
        f"비밀번호 재설정 요청을 받았습니다.\n{value}\n"
        "30분 안에 새 비밀번호를 설정해 주세요. 본인이 요청하지 않았다면 무시해 주세요."
        if reset
        else f"인증 코드: {value}\n10분 이내에 가입 화면에서 입력해 주세요."
    )
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
    *,
    reset_mail: Callable[[str, str], None] | None = None,
    google_transport: httpx2.AsyncBaseTransport | None = None,
) -> FastAPI:
    config = settings or Settings.from_environment()
    if config.environment != "test" and any(
        value is not None for value in (mail, clock, reset_mail, google_transport)
    ):
        raise RuntimeError("Test dependencies cannot launch a non-test server")
    db = engine or create_engine(
        config.database_url.get_secret_value(), hide_parameters=True, pool_pre_ping=True
    )
    send = mail or (lambda address, value: smtp_mail(config, address, value))
    send_reset = reset_mail or (
        lambda address, value: smtp_mail(config, address, value, reset=True)
    )
    now_fn = clock or utcnow
    key = config.security_key.get_secret_value()
    dummy_hash = passwords.hash(token())
    # FR-U-01/NFR-08: this SDK logs PKCE verifiers at DEBUG. Never enable that logger.
    logging.getLogger("authlib.integrations.base_client.sync_app").disabled = True
    # HTTP dependency request/debug logs can contain complete URLs and headers.
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("httpcore2").setLevel(logging.WARNING)
    google = None
    if config.google_configured:
        assert config.google_client_secret is not None
        google = OAuth().register(
            "google",
            client_id=config.google_client_id,
            client_secret=config.google_client_secret.get_secret_value(),
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            access_token_url="https://oauth2.googleapis.com/token",
            jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
            id_token_signing_alg_values_supported=["RS256"],
            client_kwargs={
                "scope": "openid email",
                "code_challenge_method": "S256",
                "token_endpoint_auth_method": "client_secret_post",
                "timeout": 10,
                "trust_env": False,
                "follow_redirects": False,
                **({"transport": google_transport} if google_transport is not None else {}),
            },
        )
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
        if (
            row["user_id"]
            and connection.scalar(
                select(users.c.credentials_version).where(users.c.id == row["user_id"])
            )
            != row["credentials_version"]
        ):
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
        response.headers["Referrer-Policy"] = "no-referrer"
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
        # FR-U-01: callback/start DB outages must not strand browser navigation on JSON.
        if (
            request.method == "GET"
            and request.url.path in {"/api/v1/auth/google/login", "/api/v1/auth/google/callback"}
            and "text/html" in request.headers.get("Accept", "").lower()
        ):
            return google_failure()
        return failure(503, "서비스 연결을 다시 시도해 주세요.")

    def new_session(
        connection: Connection,
        response: Response,
        now: datetime,
        user_id: str | None,
        credentials_version: int | None = None,
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
                credentials_version=credentials_version,
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
        connection: Connection,
        response: Response,
        row: RowMapping,
        now: datetime,
        user_id: str,
        credentials_version: int,
    ) -> str:
        connection.execute(
            update(sessions)
            .where(sessions.c.token_hash == row["token_hash"])
            .values(revoked_at=now)
        )
        return new_session(connection, response, now, user_id, credentials_version)

    def mail_keys(request: Request, email: str) -> list[tuple[str, int]]:
        # Transport peer only; ASGI server must use --no-proxy-headers (README).
        peer = request.client.host if request.client else "unknown"
        return [
            (keyed(key, "mail-email", email), 5),
            (keyed(key, "mail-ip", peer), 20),
        ]

    @app.get("/api/v1/auth/google/status", response_model=GoogleStatusOut)
    def google_status() -> dict[str, bool]:
        return {"configured": config.google_configured}

    @app.get("/api/v1/auth/google/login", status_code=303, response_class=RedirectResponse)
    async def google_login(request: Request) -> Response:
        # FR-U-01: native browser navigation returns to UI; JSON clients keep API errors.
        html = "text/html" in request.headers.get("Accept", "").lower()
        if google is None:
            return (
                google_failure("unavailable")
                if html
                else failure(503, "구글 로그인을 연결하지 못했습니다. 이메일로 로그인해 주세요.")
            )
        response = RedirectResponse(config.origin + "/start", status_code=303)

        def begin_google() -> str | None:
            with db.begin() as connection:
                now = now_fn()
                cleanup(connection, now)
                old = session(connection, request, now, locked=True)
                if old and old["user_id"]:
                    return None  # Account switching requires explicit logout.
                peer = request.client.host if request.client else "unknown"
                retry = quota(
                    connection,
                    [(keyed(key, "google-ip", peer), 10)],
                    now,
                    timedelta(minutes=1),
                    consume=True,
                )
                if retry:
                    raise HTTPException(
                        429, "잠시 후 다시 시도해 주세요.", headers={"Retry-After": str(retry)}
                    )
                if old is None:
                    new_session(connection, response, now, None)
                    raw = SimpleCookie(response.headers["set-cookie"])[config.cookie_name].value
                    session_hash = digest(raw)
                else:
                    session_hash = old["token_hash"]
                # Bound storage: only the newest attempt on this anonymous session.
                connection.execute(
                    delete(google_flows).where(google_flows.c.session_hash == session_hash)
                )
                state = token()
                connection.execute(
                    insert(google_flows).values(
                        state_hash=digest(state),
                        session_hash=session_hash,
                        created_at=now,
                        expires_at=now + timedelta(minutes=10),
                    )
                )
                return state

        try:
            state = await asyncio.to_thread(begin_google)
        except HTTPException as exc:
            if not html:
                raise
            failed = google_failure("rate-limited" if exc.status_code == 429 else "failed")
            failed.headers.update(exc.headers or {})
            return failed
        if state:
            data = await google.create_authorization_url(
                config.origin + "/api/v1/auth/google/callback",
                state=state,
                nonce=keyed(key, "google-nonce", state),
                code_verifier=keyed(key, "google-pkce", state),
                prompt="select_account",
            )
            response.headers["location"] = str(data["url"])
        return response

    def google_failure(kind: str = "failed") -> Response:
        # Fixed enum only, never provider text, code, state, email or token.
        return RedirectResponse(config.origin + "/login?google=" + kind, status_code=303)

    @app.get("/api/v1/auth/google/callback", status_code=303, response_class=RedirectResponse)
    async def google_callback(request: Request) -> Response:
        if google is None:
            return google_failure("unavailable")
        params = request.query_params
        state = params.get("state", "")
        if (
            len(params.getlist("state")) != 1
            or not re.fullmatch(r"[A-Za-z0-9_-]{43}", state)
            or len(params.getlist("code")) > 1
            or len(params.getlist("error")) > 1
        ):
            return google_failure()

        def consume() -> bool:
            with db.begin() as connection:
                old = session(connection, request, now_fn(), locked=True)
                if old is None or old["user_id"]:
                    return False
                flow = (
                    connection.execute(
                        select(google_flows)
                        .where(
                            google_flows.c.state_hash == digest(state),
                            google_flows.c.session_hash == old["token_hash"],
                        )
                        .with_for_update()
                    )
                    .mappings()
                    .first()
                )
                now = now_fn()
                if not flow or flow["used_at"] is not None or flow["expires_at"] <= now:
                    return False
                connection.execute(
                    update(google_flows)
                    .where(google_flows.c.state_hash == flow["state_hash"])
                    .values(used_at=now)
                )
                return True

        if not await asyncio.to_thread(consume):
            return google_failure()
        if "error" in params:
            return google_failure(
                "cancelled"
                if not params.getlist("code") and params["error"] == "access_denied"
                else "failed"
            )
        authorization_code = params.get("code", "")
        if (
            not authorization_code
            or len(authorization_code) > 2048
            or not all(33 <= ord(char) <= 126 for char in authorization_code)
        ):
            return google_failure()
        nonce = keyed(key, "google-nonce", state)
        try:
            provider_token = await google.fetch_access_token(
                config.origin + "/api/v1/auth/google/callback",
                code=authorization_code,
                code_verifier=keyed(key, "google-pkce", state),
            )
            info = await google.parse_id_token(
                provider_token,
                nonce=nonce,
                leeway=0,
                claims_options={
                    "iss": {"values": ["https://accounts.google.com", "accounts.google.com"]},
                    "aud": {"essential": True, "value": config.google_client_id},
                },
            )
            # Authlib permits nonce_supported:false. This Google flow never does.
            sub, email = info.get("sub"), info.get("email")
            if (
                info.get("nonce") != nonce
                or info.get("email_verified") is not True
                or not isinstance(sub, str)
                or not 1 <= len(sub) <= 255
                or not all(33 <= ord(char) <= 126 for char in sub)
                or not isinstance(email, str)
                or type(info.get("exp")) is not int
                or type(info.get("iat")) is not int
                or info["exp"] <= time.time()
            ):
                return google_failure()
            email = EmailInput(email=email).email
        except Exception:
            # Provider/SDK malformed payloads fail closed; never log exception text.
            return google_failure()

        def finish() -> Response:
            with db.begin() as connection:
                old = session(connection, request, now_fn(), locked=True)
                if old is None or old["user_id"]:
                    return google_failure()
                flow = (
                    connection.execute(
                        select(google_flows).where(
                            google_flows.c.state_hash == digest(state),
                            google_flows.c.session_hash == old["token_hash"],
                        )
                    )
                    .mappings()
                    .first()
                )
                now = now_fn()
                if not flow or flow["used_at"] is None or flow["expires_at"] <= now:
                    return google_failure()
                user = (
                    connection.execute(
                        select(users).where(users.c.google_sub == sub).with_for_update()
                    )
                    .mappings()
                    .first()
                )
                if user is None:
                    connection.execute(
                        insert(users)
                        .values(
                            id=str(uuid4()),
                            email=email,
                            google_sub=sub,
                            password_hash=None,
                            email_verified_at=now,
                            created_at=now,
                        )
                        .on_conflict_do_nothing()
                    )
                    user = (
                        connection.execute(
                            select(users).where(users.c.google_sub == sub).with_for_update()
                        )
                        .mappings()
                        .first()
                    )
                if user is None:
                    return google_failure("account-conflict")
                response = RedirectResponse(config.origin + "/start", status_code=303)
                rotate(connection, response, old, now, user["id"], user["credentials_version"])
                return response

        return await asyncio.to_thread(finish)

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
            csrf_token = rotate(connection, response, old, now, user_id, 0)
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
                payload.password.get_secret_value(),
                user["password_hash"] if user and user["password_hash"] else dummy_hash,
            )
            if not valid or user is None or not user["password_hash"]:
                for k, _ in keys:
                    connection.execute(
                        update(limits)
                        .where(limits.c.key_hash == k)
                        .values(count=limits.c.count + 1)
                    )
                return failure(401, "이메일 또는 비밀번호를 확인해 주세요.")
            now = now_fn()
            protect(connection, request, now)
            csrf_token = rotate(
                connection, response, old, now, user["id"], user["credentials_version"]
            )
            return {"id": user["id"], "email": user["email"], "csrf_token": csrf_token}

    def deliver_reset(email: str) -> None:
        # FR-U-03: response is already sent; neither SMTP latency nor existence changes it.
        hashed = ""
        try:
            with db.begin() as connection:
                user_id = connection.scalar(
                    select(users.c.id)
                    .where(users.c.email == email, users.c.password_hash.is_not(None))
                    .with_for_update()
                )
                if user_id is None:
                    return
                raw, now = token(), now_fn()
                hashed = digest(raw)
                connection.execute(
                    insert(resets)
                    .values(
                        user_id=user_id,
                        token_hash=hashed,
                        created_at=now,
                        expires_at=now + timedelta(minutes=30),
                        used_at=None,
                    )
                    .on_conflict_do_update(
                        index_elements=[resets.c.user_id],
                        set_={
                            "token_hash": hashed,
                            "created_at": now,
                            "expires_at": now + timedelta(minutes=30),
                            "used_at": None,
                        },
                    )
                )
            # Only configured origin, never Host; fragment stays out of HTTP URLs.
            send_reset(email, config.origin + "/password/reset#token=" + raw)
        except Exception:
            logging.getLogger("bodyguard.auth").error("Password recovery delivery failed")
            if hashed:
                try:
                    with db.begin() as connection:
                        connection.execute(delete(resets).where(resets.c.token_hash == hashed))
                except SQLAlchemyError:
                    logging.getLogger("bodyguard.auth").error("Password recovery cleanup failed")

    @app.post("/api/v1/auth/password/forgot", status_code=202, response_model=ErrorOut)
    def forgot(payload: EmailInput, request: Request, background: BackgroundTasks) -> Response:
        with db.begin() as connection:
            protect(connection, request, now_fn())
            if not config.mail_configured and reset_mail is None:
                return failure(503, "메일 연결을 확인할 수 없습니다. 다시 시도해 주세요.")
            retry = quota(
                connection,
                mail_keys(request, payload.email),
                now_fn(),
                timedelta(hours=1),
                consume=True,
            )
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
        # ponytail: native background delivery can be lost on process exit; re-request,
        # then add a durable outbox only if operational throughput/reliability requires it.
        background.add_task(deliver_reset, payload.email)
        return JSONResponse(
            {"detail": "요청을 접수했습니다. 등록된 이메일이면 재설정 안내를 받을 수 있습니다."},
            status_code=202,
        )

    @app.post("/api/v1/auth/password/reset", status_code=204)
    def reset_password(payload: ResetInput, request: Request) -> Response:
        hashed = digest(payload.token.get_secret_value())
        with db.begin() as connection:
            protect(connection, request, now_fn())
            peer = request.client.host if request.client else "unknown"
            retry = quota(
                connection,
                [(keyed(key, "reset-ip", peer), 30)],
                now_fn(),
                timedelta(minutes=1),
                consume=True,
            )
            if retry:
                return failure(429, "잠시 후 다시 시도해 주세요.", retry)
            # Discover, then lock user → reset, matching issuance and avoiding reverse locks.
            user_id = connection.scalar(
                select(resets.c.user_id).where(resets.c.token_hash == hashed)
            )
            if user_id is None:
                return failure(400, "링크가 만료되었거나 사용할 수 없습니다. 다시 요청해 주세요.")
            user_id = connection.scalar(
                select(users.c.id)
                .where(users.c.id == user_id, users.c.password_hash.is_not(None))
                .with_for_update()
            )
            row = (
                connection.execute(
                    select(resets).where(resets.c.user_id == user_id).with_for_update()
                )
                .mappings()
                .first()
            )
            now = now_fn()
            protect(connection, request, now)
            if (
                not row
                or row["token_hash"] != hashed
                or row["used_at"] is not None
                or row["expires_at"] <= now
            ):
                return failure(400, "링크가 만료되었거나 사용할 수 없습니다. 다시 요청해 주세요.")
            connection.execute(
                update(users)
                .where(users.c.id == user_id)
                .values(
                    password_hash=passwords.hash(payload.password.get_secret_value()),
                    credentials_version=users.c.credentials_version + 1,
                )
            )
            connection.execute(
                update(resets).where(resets.c.user_id == user_id).values(used_at=now)
            )
        response = Response(status_code=204)
        response.delete_cookie(
            config.cookie_name, httponly=True, secure=config.secure_cookie, samesite="lax", path="/"
        )
        return response

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
