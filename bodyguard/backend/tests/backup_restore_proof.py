"""NFR-08/FR-U-05: owned native PostgreSQL proof, never an operational restore tool."""

import hashlib
import json
import os
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import URL, Engine, create_engine, delete, insert, select, text, update
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.db import (
    baselines,
    metadata,
    minute_summaries,
    notification_preferences,
    stretch_records,
    user_profiles,
    users,
)
from app.main import create_app
from app.security import passwords

BACKEND = Path(__file__).resolve().parents[1]
ORIGIN = "https://bodyguard.test"
ROLE = "bodyguard_test"


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


class _OwnedCluster:
    """Only internally allocated paths and the PID recorded after our own start are used."""

    def __init__(self, root: Path, name: str, binaries: Path) -> None:
        self.root = root
        self.directory = root / name
        self.directory.mkdir(mode=0o700)
        self.data = self.directory / "data"
        self.socket = self.directory / "socket"
        self.socket.mkdir(mode=0o700)
        self.password_file = self.directory / "empty.pgpass"
        self.password_file.touch(mode=0o600, exist_ok=False)
        self.binaries = binaries
        self.identities = {
            path: (path.stat().st_dev, path.stat().st_ino)
            for path in (root, self.directory, self.socket)
        }
        self.pid: int | None = None
        self.started = False
        self.environment = {
            "PATH": str(binaries) + ":/usr/bin:/bin",
            "LC_ALL": "C",
            "TZ": "UTC",
            "PGPASSFILE": str(self.password_file),
        }

    def guard(self) -> None:
        _require(
            self.root.parent == Path("/private/tmp")
            and self.root.name.startswith("bodyguard-backup-proof."),
            "Refusing non-proof cluster path",
        )
        for path, identity in self.identities.items():
            info = path.lstat()
            _require(
                stat.S_ISDIR(info.st_mode)
                and info.st_uid == os.getuid()
                and info.st_mode & 0o077 == 0
                and (info.st_dev, info.st_ino) == identity
                and path.resolve() == path,
                "Owned cluster directory changed; refusing command",
            )

    def command(
        self, tool: str, *arguments: str, check: bool = True
    ) -> subprocess.CompletedProcess:
        self.guard()
        _require(tool in {"initdb", "pg_ctl", "createdb", "pg_dump", "pg_restore"}, "Unknown tool")
        result = subprocess.run(
            [str(self.binaries / tool), *arguments],
            env=self.environment,
            capture_output=True,
            timeout=90,
            check=False,
        )
        # Private native diagnostics may contain SQL. Never copy them to a report or exception.
        with (self.directory / "commands.log").open("ab") as output:
            output.write(result.stdout + result.stderr)
        (self.directory / "commands.log").chmod(0o600)
        if check:
            _require(result.returncode == 0, "Owned native PostgreSQL command failed")
        return result

    def start(self) -> None:
        self.command(
            "initdb",
            "-D",
            str(self.data),
            "-U",
            ROLE,
            "--auth-local=trust",
            "--auth-host=reject",
            "--locale=C",
            "--encoding=UTF8",
        )
        self.identities[self.data] = (self.data.stat().st_dev, self.data.stat().st_ino)
        try:
            self.command(
                "pg_ctl",
                "-D",
                str(self.data),
                "-l",
                str(self.directory / "server.log"),
                "-o",
                f"-k {self.socket} -c listen_addresses='' -c unix_socket_permissions=0700",
                "-w",
                "-t",
                "30",
                "start",
            )
        finally:
            pidfile = self.data / "postmaster.pid"
            if pidfile.exists():
                self.guard()
                _require(not pidfile.is_symlink(), "Refusing changed PID file")
                fields = pidfile.read_text().splitlines()
                _require(
                    len(fields) >= 2 and fields[1] == str(self.data), "Owned PID path mismatch"
                )
                self.pid = int(fields[0])
                _require(self.pid > 1, "Invalid owned PID")
                self.started = True
        self.command("createdb", "-h", str(self.socket), "-U", ROLE, "-w", ROLE)

    def url(self) -> URL:
        self.guard()
        return URL.create(
            "postgresql+psycopg",
            username=ROLE,
            database=ROLE,
            query={"host": str(self.socket), "port": "5432", "passfile": str(self.password_file)},
        )

    def verify_server(self, db: Engine) -> None:
        self.guard()
        with db.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT current_database(), current_user, current_setting('data_directory'), "
                    "current_setting('listen_addresses'), inet_server_addr(), "
                    "current_setting('server_version_num')::int"
                )
            ).one()
        _require(
            row[:5] == (ROLE, ROLE, str(self.data), "", None) and 180000 <= row[5] < 190000,
            "Refusing different server identity or network listener",
        )

    def stop(self) -> bool:
        self.guard()
        if self.started:
            pidfile = self.data / "postmaster.pid"
            _require(not pidfile.is_symlink(), "Refusing changed PID file")
            fields = pidfile.read_text().splitlines()
            _require(
                len(fields) >= 2 and int(fields[0]) == self.pid and fields[1] == str(self.data),
                "PID ownership changed; refusing stop",
            )
            process = subprocess.run(
                ["/bin/ps", "-p", str(self.pid), "-o", "uid=,comm="],
                env=self.environment,
                capture_output=True,
                timeout=10,
                check=False,
            )
            identity = process.stdout.decode().strip().split(maxsplit=1)
            _require(
                process.returncode == 0 and len(identity) == 2,
                "Owned process identity unavailable; refusing stop",
            )
            _require(
                int(identity[0]) == os.getuid()
                and Path(identity[1]).resolve() == self.binaries / "postgres",
                "PID command ownership changed; refusing stop",
            )
            # ps output is not a shell serialization. Never parse arbitrary arguments as shell.
            command = subprocess.run(
                ["/bin/ps", "-p", str(self.pid), "-o", "args="],
                env=self.environment,
                capture_output=True,
                timeout=10,
                check=False,
            )
            prefix = f"{self.binaries / 'postgres'} -D {self.data} "
            _require(
                command.returncode == 0 and command.stdout.decode().strip().startswith(prefix),
                "PID data directory changed; refusing stop",
            )
            self.command("pg_ctl", "-D", str(self.data), "-w", "-t", "30", "-m", "fast", "stop")
            self.started = False
        if self.data.exists():
            result = self.command("pg_ctl", "-D", str(self.data), "status", check=False)
            return result.returncode == 3 and not (self.data / "postmaster.pid").exists()
        return True


def _fingerprint(db: Engine) -> str:
    # Full application contents including security tables are compared only in private memory.
    with db.connect() as connection:
        rows = [
            [
                table.name,
                [
                    list(row)
                    for row in connection.execute(
                        select(table).order_by(*table.primary_key.columns)
                    )
                ],
            ]
            for table in metadata.sorted_tables
        ]
    return hashlib.sha256(json.dumps(rows, default=str).encode()).hexdigest()


def _schema(db: Engine) -> list[list[Any]]:
    with db.connect() as connection:
        return [
            list(row)
            for row in connection.execute(
                text(
                    "SELECT 'constraint', rel.relname, con.conname, "
                    "pg_get_constraintdef(con.oid, true) FROM pg_constraint con "
                    "JOIN pg_class rel ON rel.oid = con.conrelid "
                    "JOIN pg_namespace ns ON ns.oid = rel.relnamespace WHERE ns.nspname = 'public' "
                    "UNION ALL SELECT 'index', tablename, indexname, indexdef FROM pg_indexes "
                    "WHERE schemaname = 'public' "
                    "UNION ALL SELECT 'column', table_name, column_name, "
                    "data_type || ':' || is_nullable || ':' || COALESCE(column_default, '') "
                    "|| ':' || COALESCE(character_maximum_length::text, '') "
                    "|| ':' || COALESCE(numeric_precision::text, '') "
                    "|| ':' || COALESCE(numeric_scale::text, '') "
                    "|| ':' || COALESCE(datetime_precision::text, '') "
                    "FROM information_schema.columns WHERE table_schema = 'public' "
                    "ORDER BY 1, 2, 3, 4"
                )
            )
        ]


def _schemas_equivalent(source: list[list[Any]], target: list[list[Any]]) -> bool:
    # Native 18.6 restore reparses this ONE array cast into element casts. No other
    # difference is accepted. Keep both original deparses as private failure evidence.
    rendered = {
        "CHECK (outcome::text = ANY (ARRAY['completed'::character varying, "
        "'interrupted'::character varying, 'skipped'::character varying]::text[]))",
        "CHECK (outcome::text = ANY (ARRAY['completed'::character varying::text, "
        "'interrupted'::character varying::text, 'skipped'::character varying::text]))",
    }
    if len(source) != len(target):
        return False
    profile_gender_rendered = {
        "CHECK (gender IS NULL OR (gender::text = ANY (ARRAY['male'::character varying, "
        "'female'::character varying]::text[])))",
        "CHECK (gender IS NULL OR (gender::text = ANY (ARRAY['male'::character varying::text, "
        "'female'::character varying::text])))",
    }
    for before, after in zip(source, target, strict=True):
        if before == after:
            continue
        if (
            before[:3] == after[:3] == ["constraint", "user_profiles", "profile_gender"]
            and before[3] in profile_gender_rendered
            and after[3] in profile_gender_rendered
        ):
            continue
        if not (
            before[:3] == after[:3] == ["constraint", "stretch_records", "record_outcome"]
            and before[3] in rendered
            and after[3] in rendered
        ):
            return False
    return True


def _counts(db: Engine) -> dict[str, int]:
    with db.connect() as connection:
        return {
            "users": connection.execute(text("SELECT count(*) FROM users")).scalar_one(),
            "stretch_records": connection.execute(
                text("SELECT count(*) FROM stretch_records")
            ).scalar_one(),
        }


def _login(
    client: TestClient, email: str, password: str, *, expect_status: int = 200
) -> tuple[int, str]:
    response = client.get("/api/v1/auth/csrf")
    _require(response.status_code == 200, "Owned API CSRF bootstrap failed")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]},
    )
    _require(response.status_code == expect_status, "Owned API login status mismatch")
    return response.status_code, response.json().get("csrf_token", "")


def _client(db: Engine, key: str) -> TestClient:
    # Non-test app path, real time/SQL, no fake provider. SMTP/OAuth are NOT exercised.
    config = Settings(
        environment="production",
        database_url=db.url.render_as_string(hide_password=False),
        security_key=key,
        origin=ORIGIN,
        smtp_username="synthetic@example.com",
        smtp_password=secrets.token_urlsafe(32),
        google_client_id=None,
        google_client_secret=None,
    )
    return TestClient(create_app(config, db), base_url=ORIGIN)


def _exercise_constraints(db: Engine, owner: str, record: dict[str, Any]) -> bool:
    statements = [
        (
            insert(users).values(
                id=str(uuid4()),
                email="owner@example.com",
                password_hash="synthetic-not-a-login-hash",
                email_verified_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
            ),
            "23505",
        ),
        (insert(stretch_records).values(**record), "23505"),
        (
            insert(stretch_records).values(
                **{**record, "user_id": str(uuid4()), "id": str(uuid4())}
            ),
            "23503",
        ),
        (
            insert(stretch_records).values(**{**record, "id": str(uuid4()), "observed_ms": -1}),
            "23514",
        ),
        (
            insert(stretch_records).values(**{**record, "id": str(uuid4()), "outcome": "unknown"}),
            "23514",
        ),
        (
            insert(stretch_records).values(**{**record, "id": str(uuid4()), "outcome": None}),
            "23502",
        ),
    ]
    for statement, expected in statements:
        with db.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(statement)
            except IntegrityError as error:
                _require(
                    getattr(error.orig, "sqlstate", None) == expected, "Wrong constraint failure"
                )
            else:
                raise RuntimeError("Restored constraint did not reject invalid data")
            finally:
                transaction.rollback()
    for outcome in ("completed", "interrupted", "skipped"):
        with db.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(
                    insert(stretch_records).values(
                        **{
                            **record,
                            "id": str(uuid4()),
                            "outcome": outcome,
                            "observed_ms": 0,
                        }
                    )
                )
            finally:
                transaction.rollback()
    with db.connect() as connection:
        _require(
            connection.scalar(select(users.c.id).where(users.c.id == owner)) == owner,
            "Constraint probe changed owner",
        )
    return True


def _exercise_baseline_constraints(db: Engine, owner: str) -> bool:
    with db.connect() as c:
        row = dict(
            c.execute(select(baselines).where(baselines.c.user_id == owner)).mappings().first()
        )
    for change, state in (
        ({"user_id": str(uuid4())}, "23503"),
        ({"is_active": True}, "23505"),
        ({"shoulder_value": float("nan")}, "23514"),
        ({"shoulder_value": float("inf")}, "23514"),
        ({"neck_method": "partial"}, "23514"),
        ({"shoulder_value": None}, "23502"),
        ({"client_version": "bad\n"}, "23514"),
    ):
        with db.connect() as c:
            transaction = c.begin()
            try:
                c.execute(
                    insert(baselines).values(
                        **{**row, "id": str(uuid4()), "is_active": False, **change}
                    )
                )
            except IntegrityError as error:
                _require(
                    getattr(error.orig, "sqlstate", None) == state,
                    "Wrong restored baseline constraint",
                )
            else:
                raise RuntimeError("Restored baseline constraint accepted invalid data")
            finally:
                transaction.rollback()
    return True


def run_isolated_proof(*, _interrupt_before_restore: bool = False) -> dict[str, Any]:
    """No URL/path/archive input. Preserve private artifacts, stop only newly owned clusters."""
    pg_ctl = shutil.which("pg_ctl")
    _require(pg_ctl is not None, "Native PostgreSQL 18 tools required; no skip")
    assert pg_ctl is not None
    binaries = Path(pg_ctl).resolve().parent
    root = Path(tempfile.mkdtemp(prefix="bodyguard-backup-proof.", dir="/private/tmp"))
    root.chmod(0o700)
    clusters = [_OwnedCluster(root, name, binaries) for name in ("source", "target")]
    result: dict[str, Any] = {
        "private_artifact_directory": str(root),
        "proof_completed": False,
        "operational_restore_approved": False,
    }
    stopped: list[bool] = []
    try:
        with ExitStack() as stack:
            for cluster in clusters:
                cluster.start()
            source, target = clusters
            engines = []
            for cluster in clusters:
                engine = create_engine(cluster.url(), hide_parameters=True)
                stack.callback(engine.dispose)
                engines.append(engine)
            original, restored = engines
            for cluster, db in zip(clusters, engines, strict=True):
                cluster.verify_server(db)
            if _interrupt_before_restore:
                raise RuntimeError("Intentional test-only interruption after owned starts")
            key, password = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            environment = {
                **source.environment,
                "BODYGUARD_ENVIRONMENT": "development",
                "BODYGUARD_DATABASE_URL": original.url.render_as_string(hide_password=False),
                "BODYGUARD_SECURITY_KEY": key,
                "BODYGUARD_ORIGIN": "http://localhost:5173",
            }
            migration = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=BACKEND,
                env=environment,
                capture_output=True,
                timeout=90,
                check=False,
            )
            (root / "migration.log").write_bytes(migration.stdout + migration.stderr)
            (root / "migration.log").chmod(0o600)
            _require(migration.returncode == 0, "Owned schema migration failed")
            owner, other = str(uuid4()), str(uuid4())
            now = datetime.now(UTC)
            records = [
                {
                    "user_id": user_id,
                    "id": str(uuid4()),
                    "motion_id": "neck-side",
                    "protocol_version": "fixture-not-release",
                    "started_at": now - timedelta(seconds=5),
                    "ended_at": now,
                    "created_at": now,
                    "outcome": "interrupted",
                    "observed_ms": 2000,
                    "repetitions": 0,
                }
                for user_id in (owner, owner, other)
            ]
            with original.begin() as connection:
                for user_id, email in ((owner, "owner@example.com"), (other, "other@example.com")):
                    connection.execute(
                        insert(users).values(
                            id=user_id,
                            email=email,
                            password_hash=passwords.hash(password),
                            email_verified_at=now,
                            created_at=now,
                        )
                    )
                connection.execute(insert(stretch_records), records)
                connection.execute(
                    insert(user_profiles).values(
                        user_id=owner,
                        revision=1,
                        nickname="synthetic",
                        age=28,
                        height_cm=170.5,
                        weight_kg=65.2,
                        gender="female",
                    )
                )
                connection.execute(
                    insert(notification_preferences).values(
                        user_id=owner,
                        posture_enabled=False,
                        posture_minutes=15,
                        sitting_enabled=True,
                        sitting_minutes=90,
                        sound_enabled=False,
                    )
                )
                result["revision"] = connection.scalar(
                    text("SELECT version_num FROM alembic_version")
                )
            live = stack.enter_context(_client(original, key))
            _, csrf = _login(live, "owner@example.com", password)
            old_cookie = live.cookies.get("__Host-bodyguard_session")
            baseline_bodies = [
                {
                    "id": str(uuid4()),
                    "client_version": "fixture-not-release",
                    "neck": None,
                    "trunk": None,
                    "shoulder": {"method": "fixture-shoulder", "unit": "deg", "value": 1.25},
                }
                for _ in range(3)
            ]
            saved_baselines = []
            for body in baseline_bodies[:2]:
                response = live.post(
                    "/api/v1/baselines", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}, json=body
                )
                _require(response.status_code == 201, "Source baseline API save failed")
                saved_baselines.append(response.json())
            separate = stack.enter_context(_client(original, key))
            _, other_csrf = _login(separate, "other@example.com", password)
            response = separate.post(
                "/api/v1/baselines",
                headers={"Origin": ORIGIN, "X-CSRF-Token": other_csrf},
                json=baseline_bodies[2],
            )
            _require(response.status_code == 201, "Source other baseline API save failed")
            summary_minute = now.replace(second=0, microsecond=0) - timedelta(minutes=2)
            metric = {
                "method": "fixture-shoulder",
                "unit": "deg",
                "dev_mean": None,
                "measured_sec": 0,
                "bad_sec": 0,
            }
            summary_bodies = [
                {
                    "minute_start": (summary_minute + timedelta(minutes=index % 2)).isoformat(),
                    "baseline_id": baseline_bodies[index]["id"],
                    "client_version": "fixture-not-release",
                    "coverage_sec": 60,
                    "measured_sec": 30,
                    "unmeasurable_sec": 30,
                    "present_sec": 60,
                    "background_sec": 0,
                    "any_bad_sec": 15,
                    "neck": {**metric, "method": "fixture-neck"},
                    "trunk": {**metric, "method": "fixture-trunk"},
                    "shoulder": {**metric, "dev_mean": 1.25, "measured_sec": 30, "bad_sec": 15},
                }
                for index in range(3)
            ]
            saved_summaries = []
            for client, token, bodies in (
                (live, csrf, summary_bodies[:2]),
                (separate, other_csrf, summary_bodies[2:]),
            ):
                response = client.post(
                    "/api/v1/summaries/batch",
                    headers={"Origin": ORIGIN, "X-CSRF-Token": token},
                    json={"items": bodies},
                )
                _require(response.status_code == 201, "Source minute summary API save failed")
                saved_summaries.append(response.json()["items"])
            snapshot_fingerprint, snapshot_schema = _fingerprint(original), _schema(original)
            (root / "source-schema.json").write_text(json.dumps(snapshot_schema))
            (root / "source-schema.json").chmod(0o600)
            result["source_counts"] = _counts(original)
            archive = root / "snapshot.custom"
            source.command(
                "pg_dump",
                "-h",
                str(source.socket),
                "-U",
                ROLE,
                "-w",
                "-Fc",
                "-f",
                str(archive),
                ROLE,
            )
            archive.chmod(0o600)
            result["archive_sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
            target.command("pg_restore", "--list", str(archive))
            # Actual post-snapshot changes, NOT a production reconcile policy.
            response = live.post(
                "/api/v1/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}
            )
            _require(response.status_code == 204, "Source logout failed")
            assert old_cookie is not None
            live.cookies.set(
                "__Host-bodyguard_session", old_cookie, domain="bodyguard.test", path="/"
            )
            source_revoked_status = live.get("/api/v1/me").status_code
            with original.begin() as connection:
                connection.execute(
                    delete(stretch_records).where(stretch_records.c.id == records[0]["id"])
                )
                connection.execute(delete(users).where(users.c.id == other))
                connection.execute(
                    update(users)
                    .where(users.c.id == owner)
                    .values(
                        password_hash=passwords.hash(secrets.token_urlsafe(32)),
                        credentials_version=1,
                    )
                )
            old_password_source_status, _ = _login(
                live,
                "owner@example.com",
                password,
                expect_status=401,
            )
            result["post_snapshot_source_counts"] = _counts(original)
            _require(
                result["post_snapshot_source_counts"] == {"users": 1, "stretch_records": 1},
                "Source deletion or account cascade failed",
            )
            source_before_restore = _fingerprint(original)
            with restored.connect() as connection:
                _require(
                    connection.scalar(
                        text(
                            "SELECT count(*) FROM information_schema.tables "
                            "WHERE table_schema = 'public'"
                        )
                    )
                    == 0,
                    "Target was not empty",
                )
            target.command(
                "pg_restore",
                "-h",
                str(target.socket),
                "-U",
                ROLE,
                "-w",
                "-d",
                ROLE,
                "--exit-on-error",
                "--single-transaction",
                str(archive),
            )
            result["restored_counts"] = _counts(restored)
            result["record_contents_match"] = _fingerprint(restored) == snapshot_fingerprint
            with restored.connect() as connection:
                profile = connection.execute(select(user_profiles)).mappings().one()
                result["profile_restored"] = dict(profile) == {
                    "user_id": owner,
                    "revision": 1,
                    "nickname": "synthetic",
                    "age": 28,
                    "height_cm": 170.5,
                    "weight_kg": 65.2,
                    "gender": "female",
                }
                row = connection.execute(select(notification_preferences)).mappings().one()
                result["notification_preferences_restored"] = dict(row) == {
                    "user_id": owner,
                    "posture_enabled": False,
                    "posture_minutes": 15,
                    "sitting_enabled": True,
                    "sitting_minutes": 90,
                    "sound_enabled": False,
                }
            (root / "restored-schema.json").write_text(json.dumps(_schema(restored)))
            (root / "restored-schema.json").chmod(0o600)
            result["database_constraints_preserved"] = (
                _schemas_equivalent(snapshot_schema, _schema(restored))
                and _exercise_constraints(restored, owner, records[0])
                and _exercise_baseline_constraints(restored, owner)
                and _fingerprint(restored) == snapshot_fingerprint
            )
            replay = stack.enter_context(_client(restored, key))
            replay.cookies.set(
                "__Host-bodyguard_session", old_cookie, domain="bodyguard.test", path="/"
            )
            result["post_snapshot_revocation_replay_observed"] = (
                source_revoked_status == 401 and replay.get("/api/v1/me").status_code == 200
            )
            with restored.connect() as connection:
                result["post_snapshot_deletion_replay_observed"] = (
                    connection.scalar(select(users.c.id).where(users.c.id == other)) == other
                    and connection.scalar(
                        select(stretch_records.c.id).where(stretch_records.c.id == records[0]["id"])
                    )
                    == records[0]["id"]
                )
            candidate = stack.enter_context(_client(restored, key))
            result["ready_status"] = candidate.get("/api/v1/health/ready").status_code
            result["login_status"], _ = _login(candidate, "owner@example.com", password)
            result["post_snapshot_credentials_replay_observed"] = (
                old_password_source_status == 401 and result["login_status"] == 200
            )
            listing = candidate.get("/api/v1/records/stretch")
            _require(
                listing.status_code == 200 and len(listing.json()["items"]) == 2,
                "Restored own-record flow failed",
            )
            result["other_owner_status"] = candidate.get(
                "/api/v1/records/stretch/" + records[2]["id"]
            ).status_code
            result["baseline_history_and_owner_restored"] = (
                candidate.get("/api/v1/baselines/active").json() == saved_baselines[1]
                and candidate.get("/api/v1/baselines/" + baseline_bodies[0]["id"]).json()
                == {**saved_baselines[0], "is_active": False}
                and candidate.get("/api/v1/baselines/" + baseline_bodies[2]["id"]).status_code
                == 404
            )
            result["minute_summaries_restored"] = candidate.get("/api/v1/summaries").json() == {
                "items": saved_summaries[0][::-1],
                "has_more": False,
            }
            other_candidate = stack.enter_context(_client(restored, key))
            _login(other_candidate, "other@example.com", password)
            result["minute_summary_owner_isolation_restored"] = other_candidate.get(
                "/api/v1/summaries"
            ).json() == {
                "items": saved_summaries[1],
                "has_more": False,
            }
            target_before_summary_probe = _fingerprint(restored)
            with restored.connect() as c:
                summary_row = dict(
                    c.execute(select(minute_summaries).where(minute_summaries.c.user_id == owner))
                    .mappings()
                    .first()
                )
            for change, state in (
                ({"baseline_id": baseline_bodies[2]["id"]}, "23503"),
                ({"coverage_sec": None}, "23502"),
                ({"coverage_sec": float("nan")}, "23514"),
                ({"shoulder_dev_mean": None}, "23514"),
                (
                    {
                        "measured_sec": 60,
                        "unmeasurable_sec": 0,
                        "any_bad_sec": 20,
                        **{
                            f"{metric}_{field}": value
                            for metric in ("neck", "shoulder", "trunk")
                            for field, value in (
                                ("measured_sec", 20),
                                ("bad_sec", 20),
                                ("dev_mean", 1),
                            )
                        },
                    },
                    "23514",
                ),
            ):
                with restored.connect() as c:
                    transaction = c.begin()
                    try:
                        c.execute(
                            insert(minute_summaries).values(
                                **{
                                    **summary_row,
                                    "minute_start": summary_minute - timedelta(minutes=1),
                                    **change,
                                }
                            )
                        )
                    except IntegrityError as error:
                        _require(
                            getattr(error.orig, "sqlstate", None) == state,
                            "Wrong restored summary constraint",
                        )
                    else:
                        raise RuntimeError("Restored summary constraint accepted invalid data")
                    finally:
                        transaction.rollback()
            result["minute_summary_constraints_restored"] = (
                _fingerprint(restored) == target_before_summary_probe
            )
            corrupt = root / "corrupt.custom"
            corrupt.write_bytes(b"BODYGUARD-owned-invalid-archive\n" + archive.read_bytes()[32:])
            corrupt.chmod(0o600)
            target_before_corrupt = _fingerprint(restored)
            rejected = target.command(
                "pg_restore",
                "-h",
                str(target.socket),
                "-U",
                ROLE,
                "-w",
                "-d",
                ROLE,
                "--exit-on-error",
                "--single-transaction",
                str(corrupt),
                check=False,
            )
            result["corrupt_archive_rejected"] = (
                rejected.returncode != 0 and _fingerprint(restored) == target_before_corrupt
            )
            result["restore_did_not_mutate_source"] = (
                _fingerprint(original) == source_before_restore
            )
            result["proof_completed"] = all(
                (
                    result["revision"] == "0009_optional_profile",
                    result["restored_counts"] == result["source_counts"],
                    result["record_contents_match"],
                    result["notification_preferences_restored"],
                    result["profile_restored"],
                    result["baseline_history_and_owner_restored"],
                    result["minute_summaries_restored"],
                    result["minute_summary_owner_isolation_restored"],
                    result["minute_summary_constraints_restored"],
                    result["database_constraints_preserved"],
                    result["ready_status"] == 200,
                    result["login_status"] == 200,
                    result["other_owner_status"] == 404,
                    result["corrupt_archive_rejected"],
                    result["restore_did_not_mutate_source"],
                    result["post_snapshot_deletion_replay_observed"],
                    result["post_snapshot_revocation_replay_observed"],
                    result["post_snapshot_credentials_replay_observed"],
                )
            )
    finally:
        # Attempt both independent cleanups even when proof/migration/restore fails.
        failures = []
        for cluster in reversed(clusters):
            try:
                stopped.append(cluster.stop())
            except OSError, RuntimeError, subprocess.SubprocessError, ValueError:
                failures.append("owned cluster cleanup failed")
        result["owned_servers_stopped"] = len(stopped) == 2 and all(stopped) and not failures
        (root / "aggregate-report.json").write_text(json.dumps(result, sort_keys=True) + "\n")
        (root / "aggregate-report.json").chmod(0o600)
        _require(
            result["owned_servers_stopped"], "Owned cleanup incomplete; preserve private artifacts"
        )
    # This aggregate report contains no account/record row, password, key, cookie or token.
    print(json.dumps(result, sort_keys=True))
    return result
