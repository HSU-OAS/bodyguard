"""FR-U-02/03, NFR-08: standard hashes and PostgreSQL-atomic quotas."""

import hashlib
import hmac
import math
import secrets
from datetime import datetime, timedelta

from pwdlib import PasswordHash
from sqlalchemy import Connection, delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from app.db import challenges, google_flows, limits, resets, sessions

passwords = PasswordHash.recommended()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def keyed(key: str, purpose: str, value: str) -> str:
    return hmac.new(key.encode(), f"{purpose}\0{value}".encode(), hashlib.sha256).hexdigest()


def token() -> str:
    return secrets.token_urlsafe(32)


def code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def quota(
    connection: Connection,
    keys: list[tuple[str, int]],
    now: datetime,
    window: timedelta,
    *,
    consume: bool,
) -> int:
    """Returns Retry-After. Sorted independent row locks prevent quota races/deadlocks."""
    retry = 0
    for key, maximum in sorted(keys):
        # FR-U-05: withdrawal/expiry cleanup can delete between INSERT and SELECT snapshots.
        for _ in range(3):
            connection.execute(
                insert(limits)
                .values(key_hash=key, count=0, expires_at=now + window)
                .on_conflict_do_nothing(index_elements=[limits.c.key_hash])
            )
            row = (
                connection.execute(select(limits).where(limits.c.key_hash == key).with_for_update())
                .mappings()
                .first()
            )
            if row is not None:
                break
        else:
            raise SQLAlchemyError("Security quota changed; retry request")
        if row["expires_at"] <= now:
            connection.execute(
                update(limits)
                .where(limits.c.key_hash == key)
                .values(count=0, expires_at=now + window)
            )
            count, expiry = 0, now + window
        else:
            count, expiry = row["count"], row["expires_at"]
        if count >= maximum:
            retry = max(retry, math.ceil((expiry - now).total_seconds()))
    if consume and not retry:
        for key, _ in keys:
            connection.execute(
                update(limits).where(limits.c.key_hash == key).values(count=limits.c.count + 1)
            )
    return max(retry, 0)


def cleanup(connection: Connection, now: datetime) -> None:
    """Transient security rows only; no user/history retention policy is invented."""
    # Same order as protected requests: session → challenge → quotas.
    connection.execute(delete(sessions).where(sessions.c.expires_at <= now))
    connection.execute(delete(challenges).where(challenges.c.expires_at <= now))
    connection.execute(delete(resets).where(resets.c.expires_at <= now))
    connection.execute(delete(google_flows).where(google_flows.c.expires_at <= now))
    connection.execute(delete(limits).where(limits.c.expires_at <= now))
