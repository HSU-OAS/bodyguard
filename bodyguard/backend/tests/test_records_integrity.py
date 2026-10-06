"""FR-R-03/FR-U-04: real SQL races and explicit non-destructive rollback."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, select, text

from app.db import stretch_records, users
from tests.conftest import Harness
from tests.test_records import payload


def test_records_concurrent_retries(harness: Harness) -> None:
    h = harness
    h.account()
    data = payload(h)
    headers = h.csrf()
    cookies = dict(h.client.cookies)

    def retry(_: int) -> int:
        client = h.new_client()
        client.cookies.update(cookies)
        try:
            return client.post("/api/v1/records/stretch", headers=headers, json=data).status_code
        finally:
            client.close()

    with ThreadPoolExecutor(max_workers=4) as pool:
        statuses = list(pool.map(retry, range(4)))
    assert sorted(statuses) == [200, 200, 200, 201]
    with h.engine.connect() as connection:
        assert len(connection.execute(select(stretch_records)).all()) == 1


def test_records_period_and_pages(harness: Harness) -> None:
    h = harness
    h.account()
    for _ in range(3):
        assert (
            h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h)).status_code
            == 201
        )
    first = h.client.get("/api/v1/records/stretch?limit=2").json()
    second = h.client.get("/api/v1/records/stretch?limit=2&offset=2").json()
    assert first["has_more"] is True
    assert second["has_more"] is False
    assert len({row["id"] for row in [*first["items"], *second["items"]]}) == 3
    for query in [
        "limit=101",
        "offset=-1",
        "start=2026-10-01",
        "start=2026-10-02T00:00:00Z&end=2026-10-01T00:00:00Z",
    ]:
        assert h.client.get("/api/v1/records/stretch?" + query).status_code == 422
    assert h.client.get("/api/v1/records/stretch?start=2026-10-02T00:00:00Z").json()["items"] == []


def test_records_future_and_numeric_timestamp(harness: Harness) -> None:
    h = harness
    h.account()
    data = payload(h)
    for change in [
        {"started_at": 1, "ended_at": 2},
        {
            "started_at": (h.clock.now + timedelta(hours=1)).isoformat(),
            "ended_at": (h.clock.now + timedelta(hours=2)).isoformat(),
        },
    ]:
        assert (
            h.client.post(
                "/api/v1/records/stretch", headers=h.csrf(), json={**data, **change}
            ).status_code
            == 422
        )


def test_records_rollback_preserves_accounts_and_refuses_data_loss(harness: Harness) -> None:
    h = harness
    user_id = h.account()
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h)).status_code
        == 201
    )
    config = Config("alembic.ini")
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "0003_google_auth")
    with h.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0008_minute_summaries"
        )
        assert len(connection.execute(select(stretch_records)).all()) == 1
    # Only synthetic rows in the already validated, exclusively used test DB.
    with h.engine.begin() as connection:
        connection.execute(delete(stretch_records))
    command.downgrade(config, "0003_google_auth")
    with h.engine.connect() as connection:
        assert connection.scalar(select(users.c.id)) == user_id
    command.upgrade(config, "head")
    assert h.client.get("/api/v1/records/stretch").json()["items"] == []
