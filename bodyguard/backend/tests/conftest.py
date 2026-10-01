"""FR-U-02/03, NFR-08: isolated real PostgreSQL, controllable clock/mail only."""

import os
import secrets
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Engine, create_engine, make_url, text

from app.config import Settings
from app.main import create_app

ORIGIN = "http://localhost:5173"
PASSWORD = "가상 사용자 비밀번호 12345"


class Clock:
    now = datetime(2026, 10, 1, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


class Outbox:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []
        self.fail = False

    def __call__(self, email: str, code: str) -> None:
        if self.fail:
            raise RuntimeError("test provider failed")
        self.messages.append((email, code))


@contextmanager
def test_database() -> Iterator[Engine]:
    raw = os.environ.get("BODYGUARD_TEST_DATABASE_URL")
    if not raw:
        pytest.fail("Set isolated BODYGUARD_TEST_DATABASE_URL (no skip)")
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg" or url.database != "bodyguard_test":
        pytest.fail("Refusing non-test database")
    if url.username != "bodyguard_test" or url.host not in (None, "localhost", "127.0.0.1"):
        pytest.fail("Refusing non-local test role/host")
    if url.host is None and not str(url.query.get("host", "")).startswith(
        "/private/tmp/bodyguard-auth-test."
    ):
        pytest.fail("Refusing unowned PostgreSQL socket")
    db = create_engine(raw, hide_parameters=True, pool_size=12, max_overflow=8)
    with db.connect() as connection:
        assert (
            180000 <= int(connection.execute(text("SHOW server_version_num")).scalar_one()) < 190000
        )
        assert (
            connection.execute(text("SELECT current_database()")).scalar_one() == "bodyguard_test"
        )
    # Migrate the fresh local DB using the same executable migration, not create_all().
    os.environ["BODYGUARD_DATABASE_URL"] = raw
    os.environ["BODYGUARD_SECURITY_KEY"] = secrets.token_urlsafe(32)
    os.environ["BODYGUARD_ENVIRONMENT"] = "development"
    os.environ["BODYGUARD_ORIGIN"] = ORIGIN
    command.upgrade(Config("alembic.ini"), "head")
    try:
        yield db
    finally:
        db.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    with test_database() as db:
        yield db


@pytest.fixture
def harness(engine: Engine) -> Iterator[Harness]:
    # Validated dedicated DB only; no drop/reset of user or production schemas.
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE sessions, signup_challenges, auth_limits, users CASCADE"))
    h = Harness(engine)
    yield h
    h.client.close()


class Harness:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self.clock = Clock()
        self.mail = Outbox()
        self.settings = Settings(
            environment="test",
            database_url=engine.url.render_as_string(hide_password=False),
            security_key=secrets.token_urlsafe(32),
            origin=ORIGIN,
        )
        self.client = self.new_client()

    def new_client(self, peer: str = "testclient") -> TestClient:
        return TestClient(
            create_app(self.settings, self.engine, self.mail, self.clock, reset_mail=self.mail),
            base_url="http://localhost",
            client=(peer, 50000),
        )

    def csrf(self, client: TestClient | None = None) -> dict[str, str]:
        c = client or self.client
        response = c.get("/api/v1/auth/csrf")
        assert response.status_code == 200
        return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}

    def signup(self, email: str = "person@example.com", password: str = PASSWORD) -> str:
        response = self.client.post(
            "/api/v1/auth/signup",
            headers=self.csrf(),
            json={"email": email, "password": password},
        )
        assert response.status_code == 202, response.text
        return str(response.json()["challenge_id"])

    def verify(self, challenge: str, code: str | None = None) -> Response:
        response = self.client.post(
            "/api/v1/auth/verify",
            headers=self.csrf(),
            json={"challenge_id": challenge, "code": code or self.mail.messages[-1][1]},
        )
        assert isinstance(response, Response)
        return response

    def account(self, email: str = "person@example.com", password: str = PASSWORD) -> str:
        response = self.verify(self.signup(email, password))
        assert response.status_code == 201, response.text
        return str(response.json()["id"])

    def login(self, email: str = "person@example.com", password: str = PASSWORD) -> Response:
        response = self.client.post(
            "/api/v1/auth/login",
            headers=self.csrf(),
            json={"email": email, "password": password},
        )
        assert isinstance(response, Response)
        return response
