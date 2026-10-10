"""FR-U-04/05, NFR-08: actual FK faults on the ownership-guarded test DB only."""

import hashlib
import socket
import time
from collections.abc import Iterator
from contextlib import contextmanager
from threading import Thread
from uuid import uuid4

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text

from app.config import Settings
from app.db import metadata
from app.main import create_app
from tests.conftest import Harness

FK_CASES = [
    ("minute_summaries", ["user_id"]),
    ("minute_summaries", ["user_id", "baseline_id"]),
    ("baselines", ["user_id"]),
    ("notification_preferences", ["user_id"]),
    ("stretch_records", ["user_id"]),
    ("google_flows", ["session_hash"]),
    ("sessions", ["user_id"]),
    ("password_resets", ["user_id"]),
    ("account_withdrawals", ["user_id"]),
]


def snapshot(harness: Harness) -> str:
    # FR-U-05: digest-only comparison of owned synthetic rows; no credential output.
    with harness.engine.connect() as connection:
        rows = [
            (table.name, connection.execute(select(table).order_by(*table.primary_key)).all())
            for table in sorted(metadata.tables.values(), key=lambda table: table.name)
        ]
    return hashlib.sha256(repr(rows).encode()).hexdigest()


def fk_definition(harness: Harness, table: str, columns: list[str]) -> tuple[str, str]:
    # Metadata-independent native catalog oracle. No credential/user values in output.
    with harness.engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT c.conname, pg_catalog.pg_get_constraintdef(c.oid) "
                "FROM pg_catalog.pg_constraint c WHERE c.contype = 'f' "
                "AND c.conrelid = pg_catalog.to_regclass(:table) "
                "AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) "
                "WITH ORDINALITY k(num, pos) JOIN pg_catalog.pg_attribute a "
                "ON a.attrelid = c.conrelid AND a.attnum = k.num ORDER BY k.pos) "
                "= CAST(:columns AS text[])"
            ),
            {"table": table, "columns": columns},
        ).all()
    assert len(rows) == 1
    return str(rows[0][0]), str(rows[0][1])


@contextmanager
def replaced_fk(
    harness: Harness, table: str, columns: list[str], fault: str = "missing"
) -> Iterator[None]:
    name, original = fk_definition(harness, table, columns)
    quote = harness.engine.dialect.identifier_preparer.quote
    target = f"ALTER TABLE {quote(table)}"
    definition = original
    if fault == "delete":
        definition = original.replace("ON DELETE CASCADE", "ON DELETE NO ACTION")
    elif fault == "parent":
        definition = original.replace("REFERENCES users(id)", "REFERENCES sessions(token_hash)")
    elif fault == "order":
        definition = original.replace("baselines(user_id, id)", "baselines(id, user_id)")
    elif fault == "match":
        definition = original.replace("ON DELETE CASCADE", "MATCH FULL ON DELETE CASCADE")
    elif fault == "unvalidated":
        definition += " NOT VALID"
    elif fault == "deferred":
        definition += " DEFERRABLE INITIALLY DEFERRED"
    elif fault == "deferrable":
        definition += " DEFERRABLE INITIALLY IMMEDIATE"
    elif fault == "unenforced":
        definition += " NOT ENFORCED"
    elif fault == "update":
        definition += " ON UPDATE CASCADE"
    assert fault == "missing" or definition != original
    try:
        with harness.engine.begin() as connection:
            connection.execute(text(f"{target} DROP CONSTRAINT {quote(name)}"))
            if fault != "missing":
                connection.execute(text(f"{target} ADD CONSTRAINT {quote(name)} {definition}"))
        yield
    finally:
        with harness.engine.begin() as connection:
            connection.execute(text(f"{target} DROP CONSTRAINT IF EXISTS {quote(name)}"))
            connection.execute(text(f"{target} ADD CONSTRAINT {quote(name)} {original}"))


def unavailable(client: TestClient | httpx.Client) -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "set-cookie" not in response.headers
    live = client.get("/api/v1/health/live")
    assert live.status_code == 200
    assert live.json() == {"status": "alive"}
    assert "set-cookie" not in live.headers


@pytest.mark.parametrize("table,columns", FK_CASES)
def test_missing_required_native_fk_is_not_ready(
    harness: Harness, table: str, columns: list[str]
) -> None:
    harness.account()
    before, mail = snapshot(harness), len(harness.mail.messages)
    assert harness.client.get("/api/v1/health/ready").status_code == 200
    with replaced_fk(harness, table, columns):
        unavailable(harness.client)
    assert harness.client.get("/api/v1/health/ready").status_code == 200
    assert snapshot(harness) == before
    assert len(harness.mail.messages) == mail


@pytest.mark.parametrize(
    "table,columns,fault",
    [
        ("sessions", ["user_id"], "delete"),
        ("stretch_records", ["user_id"], "parent"),
        ("minute_summaries", ["user_id", "baseline_id"], "order"),
        ("minute_summaries", ["user_id", "baseline_id"], "match"),
        ("stretch_records", ["user_id"], "unvalidated"),
        ("stretch_records", ["user_id"], "deferred"),
        ("stretch_records", ["user_id"], "deferrable"),
        ("stretch_records", ["user_id"], "unenforced"),
        ("stretch_records", ["user_id"], "update"),
    ],
)
def test_wrong_native_fk_semantics_is_not_ready(
    harness: Harness, table: str, columns: list[str], fault: str
) -> None:
    harness.account()
    before, mail = snapshot(harness), len(harness.mail.messages)
    with replaced_fk(harness, table, columns, fault):
        unavailable(harness.client)
    assert harness.client.get("/api/v1/health/ready").status_code == 200
    assert snapshot(harness) == before
    assert len(harness.mail.messages) == mail


@pytest.mark.parametrize("table", ["stretch_records", "users"])
def test_native_fk_child_or_parent_triggers_disabled_is_not_ready(
    harness: Harness, table: str
) -> None:
    before = snapshot(harness)
    try:
        with harness.engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER ALL"))
        unavailable(harness.client)
    finally:
        with harness.engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER ALL"))
    assert harness.client.get("/api/v1/health/ready").status_code == 200
    assert snapshot(harness) == before
    assert not harness.mail.messages


def test_native_constraint_rename_is_healthy(harness: Harness) -> None:
    name, _ = fk_definition(harness, "stretch_records", ["user_id"])
    quote = harness.engine.dialect.identifier_preparer.quote
    renamed = f"readiness_renamed_{uuid4().hex}"
    before = snapshot(harness)
    try:
        with harness.engine.begin() as connection:
            connection.execute(
                text(f"ALTER TABLE stretch_records RENAME CONSTRAINT {quote(name)} TO {renamed}")
            )
        assert harness.client.get("/api/v1/health/ready").status_code == 200
    finally:
        with harness.engine.begin() as connection:
            connection.execute(
                text(f"ALTER TABLE stretch_records RENAME CONSTRAINT {renamed} TO {quote(name)}")
            )
    assert snapshot(harness) == before


@pytest.mark.parametrize("mode,status", [("replica", 503), ("local", 200)])
def test_native_replication_role_does_not_bypass_fk_readiness(
    harness: Harness, mode: str, status: int
) -> None:
    before = snapshot(harness)
    db = create_engine(
        harness.engine.url.update_query_dict({"options": f"-c session_replication_role={mode}"}),
        hide_parameters=True,
    )
    try:
        with TestClient(create_app(harness.settings, db), base_url="http://localhost") as client:
            if status == 503:
                unavailable(client)
            else:
                assert client.get("/api/v1/health/ready").status_code == status
    finally:
        db.dispose()
    assert snapshot(harness) == before


def test_other_schema_constraint_cannot_mask_missing_app_fk(harness: Harness) -> None:
    schema = f"readiness_shadow_{uuid4().hex}"
    before = snapshot(harness)
    try:
        with harness.engine.begin() as connection:
            connection.execute(text(f"CREATE SCHEMA {schema}"))
            connection.execute(text(f"CREATE TABLE {schema}.users (LIKE users INCLUDING ALL)"))
            connection.execute(
                text(f"CREATE TABLE {schema}.stretch_records (LIKE stretch_records INCLUDING ALL)")
            )
            connection.execute(
                text(
                    f"ALTER TABLE {schema}.stretch_records ADD FOREIGN KEY (user_id) "
                    f"REFERENCES {schema}.users(id) ON DELETE CASCADE"
                )
            )
        with replaced_fk(harness, "stretch_records", ["user_id"]):
            unavailable(harness.client)
    finally:
        with harness.engine.begin() as connection:
            # Only these two newly-created, ownership-guarded test tables, no CASCADE glob.
            connection.execute(text(f"DROP TABLE {schema}.stretch_records, {schema}.users"))
            connection.execute(text(f"DROP SCHEMA {schema}"))
    assert harness.client.get("/api/v1/health/ready").status_code == 200
    assert snapshot(harness) == before


def test_actual_production_http_fk_failure_and_recovery(harness: Harness) -> None:
    settings = Settings(
        environment="production",
        database_url=harness.settings.database_url,
        security_key=harness.settings.security_key,
        origin="https://bodyguard.example.invalid",
        smtp_username="synthetic@example.invalid",
        smtp_password="synthetic-never-a-real-credential",
    )
    # Real loopback HTTP/native PG, not HTTPS, provider or deployment verification.
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        server = uvicorn.Server(
            uvicorn.Config(
                create_app(settings, harness.engine),
                access_log=False,
                proxy_headers=False,
                log_level="critical",
                lifespan="off",
            )
        )
        thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 3
            while not server.started and time.monotonic() < deadline:
                time.sleep(0.01)
            assert server.started
            with httpx.Client(
                base_url=f"http://127.0.0.1:{listener.getsockname()[1]}", trust_env=False, timeout=5
            ) as client:
                before = snapshot(harness)
                assert client.get("/api/v1/health/ready").status_code == 200
                with replaced_fk(harness, "stretch_records", ["user_id"]):
                    unavailable(client)
                assert client.get("/api/v1/health/ready").status_code == 200
                assert client.get("/api/v1/me").status_code == 401
                assert client.get("/docs").status_code == 404
                assert snapshot(harness) == before
                assert not harness.mail.messages
        finally:
            server.should_exit = True
            thread.join(timeout=5)
            assert not thread.is_alive()
