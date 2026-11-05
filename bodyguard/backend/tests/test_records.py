"""FR-R-03/FR-U-04: actual isolated SQL with synthetic session summaries."""

from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, update

from app.db import stretch_records, users
from tests.conftest import Harness


def payload(h: Harness) -> dict[str, object]:
    return {
        "id": str(uuid4()),
        "motion_id": "neck-side",
        "protocol_version": "fixture-not-release",
        "started_at": (h.clock.now - timedelta(seconds=40)).isoformat(),
        "ended_at": h.clock.now.isoformat(),
        "outcome": "interrupted",
        "observed_ms": 12000,
        "repetitions": 0,
    }


def test_records_empty_save_and_read(harness: Harness) -> None:
    h = harness
    h.account()
    response = h.client.get("/api/v1/records/stretch")
    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "has_more": False,
        "total_count": 0,
        "total_observed_ms": 0,
    }
    data = payload(h)
    first = h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=data)
    assert first.status_code == 201
    assert first.json()["provenance"] == "client-reported"
    again = h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=data)
    assert again.status_code == 200
    assert first.json() == again.json()
    detail = h.client.get(f"/api/v1/records/stretch/{data['id']}")
    assert detail.json() == first.json()
    assert detail.headers["cache-control"] == "no-store"
    rows = h.client.get("/api/v1/records/stretch").json()
    assert len(rows["items"]) == 1
    assert "user_id" not in rows["items"][0]
    assert rows["total_count"] == 1
    assert rows["total_observed_ms"] == 12000
    changed = {**data, "repetitions": 1}
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=changed).status_code == 409
    )


def test_records_ownership_and_session(harness: Harness) -> None:
    h = harness
    owner = h.account()
    data = payload(h)
    assert h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=data).status_code == 201
    other = h.new_client()
    headers = h.csrf(other)
    challenge = other.post(
        "/api/v1/auth/signup",
        headers=headers,
        json={
            "email": "second@example.com",
            "password": "second fixture password 1234",
        },
    ).json()["challenge_id"]
    other.post(
        "/api/v1/auth/verify",
        headers=h.csrf(other),
        json={
            "challenge_id": challenge,
            "code": h.mail.messages[-1][1],
        },
    )
    assert other.get("/api/v1/records/stretch").json()["items"] == []
    assert other.get("/api/v1/records/stretch").json()["total_count"] == 0
    assert other.get("/api/v1/records/stretch").json()["total_observed_ms"] == 0
    assert other.get(f"/api/v1/records/stretch/{data['id']}").status_code == 404
    assert other.get(f"/api/v1/records/stretch/{uuid4()}").status_code == 404
    assert (
        other.post(
            "/api/v1/records/stretch",
            headers=h.csrf(other),
            json={
                **data,
                "user_id": owner,
            },
        ).status_code
        == 422
    )
    assert (
        other.post("/api/v1/records/stretch", headers=h.csrf(other), json=data).status_code == 201
    )
    assert other.get("/api/v1/records/stretch").json()["total_count"] == 1
    assert h.client.get("/api/v1/records/stretch").json()["total_observed_ms"] == 12000
    other.close()
    with h.engine.connect() as connection:
        assert len(connection.execute(select(stretch_records)).all()) == 2
    h.clock.now += timedelta(minutes=31)
    assert h.client.get("/api/v1/records/stretch").status_code == 401
    assert (
        h.client.post(
            "/api/v1/records/stretch", headers={"Origin": "http://localhost:5173"}, json=data
        ).status_code
        == 403
    )


def test_totals_cover_all_pages_and_empty_offsets(harness: Harness) -> None:
    h = harness
    h.account()
    headers = h.csrf()
    for index in range(23):
        data = {**payload(h), "observed_ms": (index + 1) * 1000}
        assert (
            h.client.post("/api/v1/records/stretch", headers=headers, json=data).status_code == 201
        )
    for offset, expected_items in ((0, 20), (20, 3), (100, 0)):
        response = h.client.get("/api/v1/records/stretch", params={"limit": 20, "offset": offset})
        assert response.status_code == 200
        result = response.json()
        assert len(result["items"]) == expected_items
        assert result["has_more"] is (offset == 0)
        assert result["total_count"] == 23
        assert result["total_observed_ms"] == sum(range(1, 24)) * 1000
    previous_day = h.clock.now - timedelta(days=1)
    older = {
        **payload(h),
        "started_at": (previous_day - timedelta(seconds=40)).isoformat(),
        "ended_at": previous_day.isoformat(),
    }
    assert h.client.post("/api/v1/records/stretch", headers=headers, json=older).status_code == 201
    selected = h.client.get(
        "/api/v1/records/stretch",
        params={
            "start": (h.clock.now - timedelta(seconds=1)).isoformat(),
            "end": (h.clock.now + timedelta(seconds=1)).isoformat(),
        },
    ).json()
    assert selected["total_count"] == 23
    assert selected["total_observed_ms"] == sum(range(1, 24)) * 1000
    excluded = h.client.get(
        "/api/v1/records/stretch",
        params={"start": (h.clock.now + timedelta(seconds=1)).isoformat()},
    ).json()
    assert excluded["total_count"] == 0
    assert excluded["total_observed_ms"] == 0


def test_records_revoked_credentials(harness: Harness) -> None:
    """FR-U-03: simulate the persisted credential-version revocation, not real mail."""
    h = harness
    user_id = h.account()
    headers = h.csrf()
    with h.engine.begin() as connection:
        connection.execute(
            update(users)
            .where(users.c.id == user_id)
            .values(credentials_version=users.c.credentials_version + 1)
        )
    assert h.client.get("/api/v1/records/stretch").status_code == 401
    assert (
        h.client.post("/api/v1/records/stretch", headers=headers, json=payload(h)).status_code
        == 403
    )


@pytest.mark.parametrize(
    "change",
    [
        {"observed_ms": -1},
        {"observed_ms": True},
        {"observed_ms": 41000},
        {"repetitions": -1},
        {"outcome": "safe"},
        {"coordinates": [1, 2, 3]},
        {"video": "private"},
        {"started_at": "2026-10-01T00:00:00"},
        {"motion_id": "<script>"},
        {"id": "not-uuid"},
        {"outcome": "skipped", "observed_ms": 1},
    ],
)
def test_records_reject_invalid(harness: Harness, change: dict[str, object]) -> None:
    h = harness
    h.account()
    result = h.client.post(
        "/api/v1/records/stretch", headers=h.csrf(), json={**payload(h), **change}
    )
    assert result.status_code == 422
    assert result.json() == {"detail": "입력 형식을 확인해 주세요."}


def test_records_guest_and_csrf(harness: Harness) -> None:
    h = harness
    assert h.client.get("/api/v1/records/stretch").status_code == 401
    h.account()
    assert h.client.post("/api/v1/records/stretch", json=payload(h)).status_code == 403
    assert (
        h.client.post(
            "/api/v1/records/stretch",
            headers={
                **h.csrf(),
                "Origin": "https://attacker.example",
            },
            json=payload(h),
        ).status_code
        == 403
    )
