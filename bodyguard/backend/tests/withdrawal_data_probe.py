"""FR-U-05/NFR-08: private read-only SQL oracle, never a product endpoint."""

import json
import os
import re
import stat
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from uuid import UUID

from sqlalchemy import Connection, create_engine, func, make_url, select, text

from app.db import (
    baselines,
    minute_summaries,
    notification_preferences,
    sessions,
    stretch_records,
    users,
)


def target(raw: str) -> Path:
    """Reject non-owned targets before opening any connection; never echo the URL."""
    try:
        url = make_url(raw)
        socket = Path(str(url.query.get("host", "")))
        root = socket.parent
        if (
            url.drivername != "postgresql+psycopg"
            or url.username != "bodyguard_test"
            or url.database != "bodyguard_test"
            or url.host is not None
            or url.port is not None
            or url.password is not None
            or set(url.query) != {"host"}
            or not re.fullmatch(
                r"/private/tmp/bodyguard-auth-test\.[A-Za-z0-9]+/socket", str(socket)
            )
            or socket.resolve() != socket
            or root.resolve() != root
        ):
            raise ValueError
        for directory in (root, socket):
            info = directory.stat()
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
                raise ValueError
        info = (socket / ".s.PGSQL.5432").stat()
        if info.st_uid != os.getuid() or not stat.S_ISSOCK(info.st_mode):
            raise ValueError
    except Exception:
        raise ValueError("Refusing unowned test database") from None
    return root


def identities(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or not value or set(value) - {"owner", "other", "fresh"}:
        raise ValueError("Expected fixed synthetic identity labels")
    result = {}
    for key, item in value.items():
        if not isinstance(item, str):
            raise ValueError("Expected canonical synthetic UUID")
        try:
            parsed = UUID(item)
        except ValueError:
            raise ValueError("Expected canonical synthetic UUID") from None
        if str(parsed) != item or parsed.version != 4:
            raise ValueError("Expected canonical synthetic UUID")
        result[key] = item
    if len(set(result.values())) != len(result):
        raise ValueError("Synthetic identities must differ")
    return result


@contextmanager
def read_connection(raw: str) -> Iterator[Connection]:
    root = target(raw)
    engine = create_engine(
        raw,
        hide_parameters=True,
        isolation_level="REPEATABLE READ",
        connect_args={"connect_timeout": 2, "options": "-c default_transaction_read_only=on"},
    )
    try:
        with engine.connect() as connection, connection.begin():
            connection.execute(text("SET LOCAL statement_timeout = '1000ms'"))
            connection.execute(text("SET LOCAL lock_timeout = '250ms'"))
            state = connection.execute(
                text(
                    "SELECT current_database(), current_user, "
                    "current_setting('server_version_num')::int, "
                    "current_setting('data_directory'), current_setting('listen_addresses'), "
                    "inet_server_addr() IS NULL, current_setting('transaction_read_only')"
                )
            ).one()
            if not (
                state[0:2] == ("bodyguard_test", "bodyguard_test")
                and 180000 <= state[2] < 190000
                and Path(state[3]).resolve() == root / "data"
                and state[4] == ""
                and state[5] is True
                and state[6] == "on"
            ):
                raise ValueError("Refusing mismatched test server")
            yield connection
    finally:
        engine.dispose()


def counts(raw: str, value: object) -> dict[str, dict[str, int]]:
    owners = identities(value)
    # Fixed whitelist; no email, challenge/cookie/hash or metric values can be returned.
    tables = (
        users,
        sessions,
        stretch_records,
        baselines,
        minute_summaries,
        notification_preferences,
    )
    with read_connection(raw) as connection:
        return {
            label: {
                table.name: int(
                    connection.scalar(
                        select(func.count())
                        .select_from(table)
                        .where((table.c.id if table is users else table.c.user_id) == identity)
                    )
                    or 0
                )
                for table in tables
            }
            for label, identity in owners.items()
        }


def main() -> int:
    try:
        value = json.loads(sys.stdin.read(2048))
        result = counts(os.environ.get("BODYGUARD_TEST_DATABASE_URL", ""), value)
    except Exception:
        # No SQL/URL/token/identity in stdout, stderr or failure stack.
        print("Read-only withdrawal oracle refused", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
