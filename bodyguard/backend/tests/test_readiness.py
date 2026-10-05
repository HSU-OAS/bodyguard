"""NFR-08/FR-U-04: actual app/owned SQL, never an operational DB."""

import asyncio
import hashlib
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Event, Thread
from uuid import uuid4

import httpx
import pytest
import uvicorn
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from psycopg.errors import ReadOnlySqlTransaction
from sqlalchemy import create_engine, select, text

import app.readiness as readiness
from app.config import Settings
from app.db import metadata
from app.main import create_app
from tests.conftest import Harness


@pytest.mark.parametrize(
    "path,status",
    [
        ("/api/v1/health/live", "alive"),
        ("/api/v1/health/ready", "ready"),
    ],
)
def test_runtime_first_contract(harness: Harness, path: str, status: str) -> None:
    response = harness.client.get(path)
    assert response.status_code == 200
    assert response.json() == {"status": status}
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "set-cookie" not in response.headers
    assert not harness.mail.messages


def snapshot(harness: Harness) -> str:
    # Compare every owned row without placing synthetic credentials in failure output.
    with harness.engine.connect() as connection:
        rows = [
            (table.name, connection.execute(select(table).order_by(*table.primary_key)).all())
            for table in sorted(metadata.tables.values(), key=lambda table: table.name)
        ]
    return hashlib.sha256(repr(rows).encode()).hexdigest()


def test_runtime_authenticated_get_changes_no_account_state(harness: Harness) -> None:
    harness.account()
    before = snapshot(harness)
    mail_count = len(harness.mail.messages)
    harness.clock.now += timedelta(minutes=5)
    for _ in range(3):
        for path in ("live", "ready"):
            response = harness.client.get(f"/api/v1/health/{path}")
            assert response.status_code == 200
            assert "set-cookie" not in response.headers
    assert snapshot(harness) == before
    assert len(harness.mail.messages) == mail_count


@pytest.mark.parametrize("fault", ["revision", "column"])
def test_runtime_actual_schema_failure_and_recovery(harness: Harness, fault: str) -> None:
    try:
        with harness.engine.begin() as connection:
            if fault == "revision":
                connection.execute(text("UPDATE alembic_version SET version_num = 'not_ready'"))
            else:
                connection.execute(
                    text("ALTER TABLE users RENAME COLUMN email TO unavailable_email")
                )
        response = harness.client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "unavailable"}
        assert harness.client.get("/api/v1/health/live").status_code == 200
    finally:
        with harness.engine.begin() as connection:
            if fault == "revision":
                connection.execute(
                    text("UPDATE alembic_version SET version_num = '0006_notification_preferences'")
                )
            else:
                connection.execute(
                    text("ALTER TABLE users RENAME COLUMN unavailable_email TO email")
                )
    assert harness.client.get("/api/v1/health/ready").json() == {"status": "ready"}


def test_runtime_revision_tracks_actual_migration_head() -> None:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
    assert ScriptDirectory.from_config(config).get_heads() == [readiness.EXPECTED_REVISION]


def test_runtime_live_never_checks_out_authentication_pool(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbidden_connect() -> None:
        raise AssertionError("Health used authentication pool")

    monkeypatch.setattr(harness.engine, "connect", forbidden_connect)
    assert harness.client.get("/api/v1/health/live").json() == {"status": "alive"}
    assert harness.client.get("/api/v1/health/ready").json() == {"status": "ready"}


def test_runtime_real_read_only_and_sql_timeout(harness: Harness) -> None:
    probe = harness.client.app.state.readiness_probe

    async def inspect() -> None:
        connection = await readiness.AsyncConnection.connect(
            *probe._args, **probe._kwargs, autocommit=True
        )
        try:
            async with connection.cursor() as cursor:
                for setting, expected in (
                    ("default_transaction_read_only", "on"),
                    ("statement_timeout", "1s"),
                    ("lock_timeout", "250ms"),
                ):
                    await cursor.execute("SELECT current_setting(%s)", (setting,))
                    assert await cursor.fetchone() == (expected,)
                with pytest.raises(ReadOnlySqlTransaction):
                    await cursor.execute("DELETE FROM auth_limits WHERE false")
        finally:
            await connection.close()

    asyncio.run(inspect())
    queries = probe._queries
    before = snapshot(harness)
    started = time.monotonic()
    try:
        probe._queries = ("SELECT pg_sleep(10)",)
        response = harness.client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "unavailable"}
        assert 0.7 < time.monotonic() - started < 3
    finally:
        probe._queries = queries
    assert snapshot(harness) == before
    assert harness.client.get("/api/v1/health/ready").status_code == 200


def test_runtime_actual_lock_timeout_and_recovery(harness: Harness) -> None:
    with harness.engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text("LOCK TABLE users IN ACCESS EXCLUSIVE MODE"))
            started = time.monotonic()
            response = harness.client.get("/api/v1/health/ready")
            assert response.status_code == 503
            assert response.json() == {"status": "unavailable"}
            assert time.monotonic() - started < 2
            assert harness.client.get("/api/v1/health/live").status_code == 200
        finally:
            transaction.rollback()
    assert harness.client.get("/api/v1/health/ready").status_code == 200


def test_runtime_actual_permission_failure_without_write(harness: Harness) -> None:
    # Cluster-local disposable role on the ownership-guarded test server only.
    role = f"bodyguard_readiness_{uuid4().hex}"
    with harness.engine.begin() as connection:
        connection.execute(text(f"CREATE ROLE {role} LOGIN"))
        connection.execute(text(f"GRANT SELECT ON ALL TABLES IN SCHEMA public TO {role}"))
    db = create_engine(harness.engine.url.set(username=role), hide_parameters=True)
    try:
        with TestClient(create_app(harness.settings, db), base_url="http://localhost") as client:
            before = snapshot(harness)
            response = client.get("/api/v1/health/ready")
            assert response.status_code == 503
            assert response.json() == {"status": "unavailable"}
            with harness.engine.begin() as connection:
                connection.execute(
                    text(f"GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role}")
                )
            assert client.get("/api/v1/health/ready").status_code == 200
            assert snapshot(harness) == before
    finally:
        db.dispose()
        with harness.engine.begin() as connection:
            connection.execute(text(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}"))
            connection.execute(text(f"DROP ROLE {role}"))


def test_runtime_closed_database_port_has_fixed_private_response(
    harness: Harness, caplog: pytest.LogCaptureFixture
) -> None:
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1", 0))
        url = harness.engine.url.difference_update_query(["host", "port"]).set(
            host="127.0.0.1", port=reserved.getsockname()[1]
        )
        db = create_engine(url, hide_parameters=True)
        try:
            with TestClient(create_app(harness.settings, db)) as client:
                caplog.clear()
                response = client.get("/api/v1/health/ready")
                assert response.status_code == 503
                assert response.json() == {"status": "unavailable"}
                assert response.headers["Cache-Control"] == "no-store"
                assert "set-cookie" not in response.headers
                assert client.get("/api/v1/health/live").status_code == 200
                assert not [record for record in caplog.records if record.name == "psycopg"]
        finally:
            db.dispose()


def test_runtime_actual_stalled_connection_is_bounded_and_busy_is_not_queued(
    harness: Harness,
) -> None:
    accepted, stop = Event(), Event()
    connections: list[socket.socket] = []
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        listener.settimeout(0.1)

        def stall() -> None:
            while not stop.is_set():
                try:
                    peer, _ = listener.accept()
                    connections.append(peer)
                    accepted.set()
                except TimeoutError:
                    pass

        thread = Thread(target=stall, daemon=True)
        thread.start()
        url = (
            harness.engine.url.difference_update_query(["host", "port"])
            .set(host="127.0.0.1", port=listener.getsockname()[1])
            .update_query_dict({"sslmode": "disable", "gssencmode": "disable"})
        )
        db = create_engine(url, hide_parameters=True)
        try:
            with TestClient(create_app(harness.settings, db)) as client:
                started = time.monotonic()
                with ThreadPoolExecutor(max_workers=8) as pool:
                    pending = pool.submit(client.get, "/api/v1/health/ready")
                    assert accepted.wait(1)
                    quick = time.monotonic()
                    assert client.get("/api/v1/health/live").status_code == 200
                    busy = list(pool.map(lambda _: client.get("/api/v1/health/ready"), range(6)))
                    assert all(r.status_code == 503 for r in busy)
                    assert all(r.json() == {"status": "unavailable"} for r in busy)
                    assert time.monotonic() - quick < 1
                    response = pending.result(timeout=4)
                    assert response.status_code == 503
                    assert 1.5 < time.monotonic() - started < 4
                assert len(connections) == 1
                assert not client.app.state.readiness_probe._lock.locked()
        finally:
            stop.set()
            thread.join(timeout=1)
            for peer in connections:
                peer.close()
            db.dispose()


def test_runtime_offline_openapi_matches_fixed_contract(harness: Harness) -> None:
    schema = harness.client.app.openapi()
    for name, value in (
        ("LiveOut", "alive"),
        ("ReadyOut", "ready"),
        ("UnavailableOut", "unavailable"),
    ):
        model = schema["components"]["schemas"][name]
        assert model["required"] == ["status"]
        assert set(model["properties"]) == {"status"}
        assert model["properties"]["status"]["const"] == value
    for path, success in (("live", "LiveOut"), ("ready", "ReadyOut")):
        route = schema["paths"][f"/api/v1/health/{path}"]
        assert set(route) == {"get"}
        operation = route["get"]
        assert not operation.get("parameters")
        assert not operation.get("requestBody")
        assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
            "$ref": f"#/components/schemas/{success}"
        }
    unavailable = schema["paths"]["/api/v1/health/ready"]["get"]["responses"]["503"]
    assert unavailable["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/UnavailableOut"
    }


def test_runtime_actual_url_options_are_preserved(harness: Harness) -> None:
    url = harness.engine.url.update_query_dict(
        {"options": "-c search_path=public -c statement_timeout=0 -c lock_timeout=0"}
    )
    db = create_engine(url, hide_parameters=True)
    try:
        with TestClient(create_app(harness.settings, db)) as client:
            probe = client.app.state.readiness_probe
            assert "-c search_path=public" in probe._kwargs["options"]
            assert client.get("/api/v1/health/ready").status_code == 200

            async def inspect() -> None:
                connection = await readiness.AsyncConnection.connect(
                    *probe._args, **probe._kwargs, autocommit=True
                )
                try:
                    async with connection.cursor() as cursor:
                        await cursor.execute(
                            "SELECT current_setting('search_path'), "
                            "current_setting('statement_timeout'), current_setting('lock_timeout')"
                        )
                        assert await cursor.fetchone() == ("public", "1s", "250ms")
                finally:
                    await connection.close()

            asyncio.run(inspect())
    finally:
        db.dispose()


def test_runtime_deadline_injection_releases_single_probe(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Scheduling/connect stall is injected here, unlike the real socket/SQL cases above.
    entered = Event()

    async def stalled(*args: object, **kwargs: object) -> None:
        entered.set()
        await asyncio.sleep(10)

    connect = readiness.AsyncConnection.connect
    monkeypatch.setattr(readiness.AsyncConnection, "connect", stalled)
    started = time.monotonic()
    response = harness.client.get("/api/v1/health/ready")
    assert entered.is_set()
    assert response.status_code == 503
    assert 2.8 < time.monotonic() - started < 5
    assert not harness.client.app.state.readiness_probe._lock.locked()
    monkeypatch.setattr(readiness.AsyncConnection, "connect", connect)
    assert harness.client.get("/api/v1/health/ready").status_code == 200


@pytest.mark.parametrize("version", [179999, 190000])
def test_runtime_unsupported_version_injection_is_not_ready(
    harness: Harness, monkeypatch: pytest.MonkeyPatch, version: int
) -> None:
    # Only PostgreSQL18 is actually run. This boundary uses a synthetic connection.
    class Connection:
        closed = False
        info = type("Info", (), {"server_version": version})()

        async def close(self) -> None:
            self.closed = True

    connection = Connection()

    async def connect(*args: object, **kwargs: object) -> Connection:
        return connection

    monkeypatch.setattr(readiness.AsyncConnection, "connect", connect)
    response = harness.client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert connection.closed


def test_runtime_unbounded_old_client_cancellation_is_not_used(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The actual pinned binary is libpq18; an older client is injected, not installed.
    monkeypatch.setattr(readiness.pq, "version", lambda: 169999)
    response = harness.client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert harness.client.get("/api/v1/health/live").status_code == 200


def test_runtime_actual_production_http_routes_and_db_recovery(harness: Harness) -> None:
    settings = Settings(
        environment="production",
        database_url=harness.settings.database_url,
        security_key=harness.settings.security_key,
        origin="https://bodyguard.example.invalid",
        smtp_username="synthetic@example.invalid",
        smtp_password="synthetic-never-a-real-credential",
    )
    # Production handlers over owned loopback HTTP, NOT actual HTTPS/SMTP/deployment.
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
                base_url=f"http://127.0.0.1:{listener.getsockname()[1]}",
                trust_env=False,
                timeout=5,
            ) as client:
                before = snapshot(harness)
                for path, status in (("live", "alive"), ("ready", "ready")):
                    response = client.get(f"/api/v1/health/{path}")
                    assert response.status_code == 200
                    assert response.json() == {"status": status}
                    assert response.headers["cache-control"] == "no-store"
                    assert response.headers["referrer-policy"] == "no-referrer"
                    assert "set-cookie" not in response.headers
                assert client.get("/api/v1/me").status_code == 401
                assert client.get("/docs").status_code == 404
                assert client.get("/openapi.json").status_code == 404
                try:
                    with harness.engine.begin() as connection:
                        connection.execute(
                            text("UPDATE alembic_version SET version_num = 'not_ready'")
                        )
                    response = client.get("/api/v1/health/ready")
                    assert response.status_code == 503
                    assert response.json() == {"status": "unavailable"}
                    assert client.get("/api/v1/health/live").status_code == 200
                finally:
                    with harness.engine.begin() as connection:
                        connection.execute(
                            text(
                                "UPDATE alembic_version "
                                "SET version_num = '0006_notification_preferences'"
                            )
                        )
                assert client.get("/api/v1/health/ready").status_code == 200
                assert snapshot(harness) == before
                assert not harness.mail.messages
        finally:
            server.should_exit = True
            thread.join(timeout=5)
            assert not thread.is_alive()
