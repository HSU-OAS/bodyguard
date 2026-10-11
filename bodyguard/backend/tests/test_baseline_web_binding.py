"""FR-M-03/FR-U-04: real PostgreSQL sessions, synthetic accounts; no body calibration."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.db import baselines, sessions
from tests.test_baselines import PATH, payload, save


@pytest.mark.parametrize("suffix", ["/active", "/detail"])
def test_account_cookie_aba_cannot_read_or_write_another_baseline(harness, suffix):
    h = harness
    a = h.account("baseline-a@example.com")
    proof_a, cookie_a = h.csrf(), dict(h.client.cookies)
    h.client.cookies.clear()
    b = h.account("baseline-b@example.com")
    body = payload()
    original = save(h, body)
    proof_b, cookie_b = h.csrf(), dict(h.client.cookies)
    path = PATH + ("/" + body["id"] if suffix == "/detail" else suffix)
    for proof in (proof_a, proof_b):
        h.client.cookies.clear()
        h.client.cookies.update(cookie_b)
        headers = {**proof, "X-Account-ID": a}
        assert h.client.get(path, headers=headers).status_code == 403
        assert h.client.post(PATH, headers=headers, json=payload()).status_code == 403
    assert h.client.get(path, headers={**proof_b, "X-Account-ID": b}).json() == original
    # No bound header still uses the authenticated owner, preserving existing callers.
    assert h.client.get(path).json() == original
    h.client.cookies.clear()
    h.client.cookies.update(cookie_a)
    assert h.client.get(PATH + "/active", headers={**proof_a, "X-Account-ID": a}).json() is None
    assert h.client.get(PATH + "/" + body["id"]).status_code == 404
    with h.engine.connect() as connection:
        assert len(connection.execute(select(baselines)).all()) == 1


@pytest.mark.parametrize("suffix", ["/active", "/00000000-0000-4000-8000-000000000001"])
def test_invalid_read_hint_rolls_back_activity_and_guest_cannot_use_hint(harness, suffix):
    h = harness
    assert h.client.get(PATH + suffix, headers={"X-Account-ID": "other"}).status_code == 401
    h.account()
    with h.engine.connect() as connection:
        before = connection.execute(select(sessions.c.last_seen_at)).scalars().all()
    h.clock.now += timedelta(seconds=10)
    assert (
        h.client.get(PATH + suffix, headers={**h.csrf(), "X-Account-ID": "other"}).status_code
        == 403
    )
    with h.engine.connect() as connection:
        assert connection.execute(select(sessions.c.last_seen_at)).scalars().all() == before


def test_openapi_documents_optional_binding_without_new_body_fields(harness):
    paths = harness.client.app.openapi()["paths"]
    for path, method in (
        (PATH + "/active", "get"),
        (PATH + "/{baseline_id}", "get"),
        (PATH, "post"),
    ):
        headers = {p["name"]: p for p in paths[path][method]["parameters"] if p["in"] == "header"}
        assert set(headers) == {"X-CSRF-Token", "X-Account-ID"}
        assert all(not item["required"] for item in headers.values())
