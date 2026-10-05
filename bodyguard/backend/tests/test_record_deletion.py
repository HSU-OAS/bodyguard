"""FR-U-05: owned isolated SQL deletion only, never operational/user data."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest

from tests.conftest import Harness
from tests.test_records import payload


def period(h: Harness) -> dict[str, str]:
    return {
        "start": (h.clock.now - timedelta(days=1)).isoformat(),
        "end": (h.clock.now + timedelta(seconds=1)).isoformat(),
    }


def preview(h: Harness) -> dict[str, object]:
    result = h.client.post(
        "/api/v1/records/stretch/delete-preview", headers=h.csrf(), json=period(h)
    )
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    return result.json()


def confirmed(h: Harness, proof: dict[str, object]):
    return h.client.post(
        "/api/v1/records/stretch/delete",
        headers=h.csrf(),
        json={**proof, "confirmation": "delete-stretch-records"},
    )


def test_delete_preview_and_explicit_confirmation(harness: Harness) -> None:
    h = harness
    h.account()
    item = payload(h)
    assert h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=item).status_code == 201
    proof = preview(h)
    assert proof["count"] == 1
    assert "user_id" not in proof
    assert h.client.get("/api/v1/records/stretch").json()["items"]
    missing = h.client.post("/api/v1/records/stretch/delete", headers=h.csrf(), json=proof)
    assert missing.status_code == 422
    result = confirmed(h, proof)
    assert result.status_code == 200
    assert result.json() == {"deleted": 1}
    assert h.client.get("/api/v1/records/stretch").json()["items"] == []


def test_delete_cutoff_and_repeat_preserve_new_backdated_record(harness: Harness) -> None:
    h = harness
    h.account()
    old = payload(h)
    assert h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=old).status_code == 201
    proof = preview(h)
    h.clock.now += timedelta(seconds=2)
    new = {**payload(h), "started_at": old["started_at"], "ended_at": old["ended_at"]}
    assert h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=new).status_code == 201
    assert confirmed(h, proof).json() == {"deleted": 1}
    assert confirmed(h, proof).json() == {"deleted": 0}
    assert [row["id"] for row in h.client.get("/api/v1/records/stretch").json()["items"]] == [
        new["id"]
    ]


def test_delete_expired_or_tampered_proof_keeps_record(harness: Harness) -> None:
    h = harness
    h.account()
    assert (
        h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h)).status_code
        == 201
    )
    proof = preview(h)
    assert confirmed(h, {**proof, "count": 100}).status_code == 403
    h.clock.now += timedelta(minutes=11)
    assert confirmed(h, proof).status_code == 409
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1


def test_delete_same_clock_new_record_requires_reconfirmation(harness: Harness) -> None:
    h = harness
    h.account()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    proof = preview(h)
    # Frozen server time exposes what a timestamp-only preview would erase.
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    result = confirmed(h, proof)
    assert result.status_code == 409
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 2
    assert confirmed(h, preview(h)).json() == {"deleted": 2}


def test_delete_unchosen_period_and_other_account_preserved(harness: Harness) -> None:
    h = harness
    h.account()
    chosen = payload(h)
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=chosen)
    outside = payload(h)
    outside["started_at"] = (h.clock.now - timedelta(days=2, seconds=40)).isoformat()
    outside["ended_at"] = (h.clock.now - timedelta(days=2)).isoformat()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=outside)
    proof = preview(h)
    assert proof["count"] == 1
    h.client.post("/api/v1/auth/logout", headers=h.csrf())
    h.account("other@example.com")
    other = payload(h)
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=other)
    assert confirmed(h, proof).status_code == 403
    assert [row["id"] for row in h.client.get("/api/v1/records/stretch").json()["items"]] == [
        other["id"]
    ]
    h.client.post("/api/v1/auth/logout", headers=h.csrf())
    assert h.login().status_code == 200
    assert confirmed(h, proof).status_code == 403  # New session even for original account.
    assert confirmed(h, preview(h)).json() == {"deleted": 1}
    assert [row["id"] for row in h.client.get("/api/v1/records/stretch").json()["items"]] == [
        outside["id"]
    ]


def test_delete_requires_origin_csrf_and_non_get_confirmation(harness: Harness) -> None:
    h = harness
    assert (
        h.client.post(
            "/api/v1/records/stretch/delete-preview", headers=h.csrf(), json=period(h)
        ).status_code
        == 401
    )
    h.account()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    proof = preview(h)
    body = {**proof, "confirmation": "delete-stretch-records"}
    assert h.client.post("/api/v1/records/stretch/delete", json=body).status_code == 403
    assert (
        h.client.post(
            "/api/v1/records/stretch/delete",
            headers={**h.csrf(), "Origin": "https://foreign.example"},
            json=body,
        ).status_code
        == 403
    )
    assert h.client.get("/api/v1/records/stretch/delete").status_code == 404
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1


@pytest.mark.parametrize(
    "change",
    [
        {"start": 1},
        {"start": "2026-10-01"},
        {"start": "bad"},
        {"start": "2026-10-03T00:00:00Z", "end": "2026-10-01T00:00:00Z"},
        {"user_id": "other"},
        {"video": "not-allowed"},
        {"coordinates": [0, 1, 2]},
    ],
)
def test_delete_invalid_preview(harness: Harness, change: dict[str, object]) -> None:
    h = harness
    h.account()
    result = h.client.post(
        "/api/v1/records/stretch/delete-preview",
        headers=h.csrf(),
        json={**period(h), **change},
    )
    assert result.status_code == 422
    assert result.json() == {"detail": "입력 형식을 확인해 주세요."}


@pytest.mark.parametrize(
    "name,value",
    [
        ("start", "2026-09-29T00:00:00Z"),
        ("count", 0),
        ("fingerprint", "f" * 64),
        ("signature", "f" * 64),
    ],
)
def test_delete_signed_values_cannot_be_changed(harness: Harness, name: str, value: object) -> None:
    h = harness
    h.account()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    proof = preview(h)
    assert confirmed(h, {**proof, name: value}).status_code == 403
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1


def test_delete_actual_concurrent_confirmations(harness: Harness) -> None:
    h = harness
    h.account()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    proof = preview(h)
    cookies = dict(h.client.cookies)
    headers = h.csrf()

    def submit(_: int) -> int:
        with h.new_client() as client:
            client.cookies.update(cookies)
            result = client.post(
                "/api/v1/records/stretch/delete",
                headers=headers,
                json={**proof, "confirmation": "delete-stretch-records"},
            )
            assert result.status_code == 200
            return int(result.json()["deleted"])

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert sorted(pool.map(submit, range(4))) == [0, 0, 0, 1]


@pytest.mark.parametrize(
    "change",
    [
        {"confirmation": "yes"},
        {"count": True},
        {"cutoff": "2026-10-01T00:00:00"},
        {"expires_at": 1},
        {"user_id": "other"},
        {"video": "not-allowed"},
    ],
)
def test_delete_invalid_confirmation_preserves_records(
    harness: Harness, change: dict[str, object]
) -> None:
    h = harness
    h.account()
    h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=payload(h))
    proof = preview(h)
    result = h.client.post(
        "/api/v1/records/stretch/delete",
        headers=h.csrf(),
        json={**proof, "confirmation": "delete-stretch-records", **change},
    )
    assert result.status_code == 422
    assert result.json() == {"detail": "입력 형식을 확인해 주세요."}
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1


def test_delete_empty_preview_and_period_boundaries(harness: Harness) -> None:
    h = harness
    h.account()
    assert confirmed(h, preview(h)).json() == {"deleted": 0}
    for offset in (-1, 0):
        item = payload(h)
        item["ended_at"] = (h.clock.now + timedelta(seconds=offset)).isoformat()
        item["started_at"] = (h.clock.now + timedelta(seconds=offset - 40)).isoformat()
        assert (
            h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=item).status_code == 201
        )
    result = h.client.post(
        "/api/v1/records/stretch/delete-preview",
        headers=h.csrf(),
        json={
            "start": (h.clock.now - timedelta(seconds=1)).isoformat(),
            "end": h.clock.now.isoformat(),
        },
    )
    assert result.status_code == 200
    assert result.json()["count"] == 1
    assert confirmed(h, result.json()).json() == {"deleted": 1}
    assert len(h.client.get("/api/v1/records/stretch").json()["items"]) == 1
