"""NFR-08/FR-U-04: fixed, read-only runtime probes; not a release approval."""

import asyncio
import logging
import os
from threading import Lock
from typing import Literal

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from psycopg import AsyncConnection, Error, pq
from pydantic import BaseModel
from sqlalchemy import Engine, false, select

from app.db import metadata

EXPECTED_REVISION = "0009_optional_profile"
PROBE_TIMEOUT_SECONDS = 3

# FR-U-04/05: required ownership/cascade semantics, not constraint names or user rows.
FK_QUERY = """
SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = pg_catalog.to_regclass(%s)
    AND c.conkey = ARRAY(
        SELECT a.attnum FROM unnest(%s::text[]) WITH ORDINALITY k(name, pos)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attname = k.name
        WHERE a.attnum > 0 AND NOT a.attisdropped ORDER BY k.pos
    )
    AND c.confrelid = pg_catalog.to_regclass(%s)
    AND c.confkey = ARRAY(
        SELECT a.attnum FROM unnest(%s::text[]) WITH ORDINALITY k(name, pos)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.confrelid AND a.attname = k.name
        WHERE a.attnum > 0 AND NOT a.attisdropped ORDER BY k.pos
    )
    AND c.confdeltype = %s AND c.confupdtype = %s AND c.confmatchtype = %s
    AND c.condeferrable = %s AND c.condeferred = %s AND c.convalidated AND c.conenforced
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgconstraint = c.oid)
    AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger t
        WHERE t.tgconstraint = c.oid AND t.tgenabled NOT IN ('O', 'A')
    )
)
"""
FK_ACTION = {"NO ACTION": "a", "RESTRICT": "r", "CASCADE": "c", "SET NULL": "n", "SET DEFAULT": "d"}
FK_MATCH = {"SIMPLE": "s", "FULL": "f", "PARTIAL": "p"}


class LiveOut(BaseModel):
    status: Literal["alive"]


class ReadyOut(BaseModel):
    status: Literal["ready"]


class UnavailableOut(BaseModel):
    status: Literal["unavailable"]


class ReadinessProbe:
    def __init__(self, db: Engine) -> None:
        # Use the same dialect/URL, but never check out an authentication pool connection.
        self._args, self._kwargs = db.dialect.create_connect_args(db.url)
        options = self._kwargs.get("options", os.environ.get("PGOPTIONS", ""))
        self._kwargs.update(
            connect_timeout=2,
            application_name="bodyguard-readiness",
            options=(
                f"{options} -c default_transaction_read_only=on"
                " -c statement_timeout=1000 -c lock_timeout=250"
                " -c idle_in_transaction_session_timeout=1000"
            ),
        )
        self._queries = tuple(
            str(
                select(*table.c)
                .where(false())
                .compile(dialect=db.dialect, compile_kwargs={"literal_binds": True})
            )
            for table in metadata.tables.values()
        )
        self._foreign_keys = tuple(
            (
                table.fullname,
                [element.parent.name for element in fk.elements],
                fk.referred_table.fullname,
                [element.column.name for element in fk.elements],
                FK_ACTION[(fk.ondelete or "NO ACTION").upper()],
                FK_ACTION[(fk.onupdate or "NO ACTION").upper()],
                FK_MATCH[(fk.match or "SIMPLE").upper()],
                bool(fk.deferrable),
                (fk.initially or "IMMEDIATE").upper() == "DEFERRED",
            )
            for table in sorted(metadata.tables.values(), key=lambda table: table.fullname)
            for fk in sorted(
                table.foreign_key_constraints,
                key=lambda fk: tuple(element.parent.name for element in fk.elements),
            )
        )
        self._lock = Lock()

    async def check(self) -> bool:
        # No queue, thread, pooled connection, session renewal, cleanup, or user-row query.
        # Older libpq cancellation falls back to blocking I/O without our timeout bound.
        if pq.version() < 170000:
            return False
        if not self._lock.acquire(blocking=False):
            return False
        connection = None
        try:
            async with asyncio.timeout(PROBE_TIMEOUT_SECONDS):
                connection = await AsyncConnection.connect(
                    *self._args, **self._kwargs, autocommit=True, prepare_threshold=None
                )
                if not 180000 <= connection.info.server_version < 190000:
                    return False
                async with connection.cursor() as cursor:
                    await cursor.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
                    await cursor.execute("SELECT version_num FROM alembic_version LIMIT 2")
                    if await cursor.fetchall() != [(EXPECTED_REVISION,)]:
                        return False
                    await cursor.execute(
                        "SELECT NOT pg_catalog.pg_is_in_recovery() AND "
                        "pg_catalog.current_setting('session_replication_role') "
                        "IN ('origin', 'local') AND "
                        "bool_and(pg_catalog.has_table_privilege(t, p)) "
                        "FROM unnest(%s::text[]) AS t CROSS JOIN "
                        "unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS p",
                        (list(metadata.tables),),
                    )
                    if await cursor.fetchone() != (True,):
                        return False
                    for query in self._queries:
                        # Resolves every required table/column/SELECT permission, reads zero rows.
                        await cursor.execute(query)
                    for foreign_key in self._foreign_keys:
                        await cursor.execute(FK_QUERY, foreign_key)
                        if await cursor.fetchone() != (True,):
                            return False
                return True
        except TimeoutError, Error:
            return False
        finally:
            if connection is not None:
                # Close directly: no network rollback/commit or returned pooled transaction.
                await connection.close()
            self._lock.release()


def register_readiness(app: FastAPI, db: Engine) -> None:
    # Native psycopg DEBUG/error-cancellation logs can include DB host/path details.
    logging.getLogger("psycopg").disabled = True
    probe = ReadinessProbe(db)
    app.state.readiness_probe = probe

    @app.get("/api/v1/health/live", response_model=LiveOut)
    async def live() -> LiveOut:
        return LiveOut(status="alive")

    @app.get(
        "/api/v1/health/ready",
        response_model=ReadyOut,
        responses={503: {"model": UnavailableOut}},
    )
    async def ready() -> ReadyOut | JSONResponse:
        if await probe.check():
            return ReadyOut(status="ready")
        return JSONResponse({"status": "unavailable"}, status_code=503)
