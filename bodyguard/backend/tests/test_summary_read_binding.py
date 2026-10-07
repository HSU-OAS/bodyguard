"""S4.15: real request-time binding, not a browser bookend /me assumption."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.db import sessions
from tests.test_summaries import PATH, payload, post


def test_cookie_aba_cannot_return_other_owner(harness):
    h = harness
    owner_a = h.account("a@example.com")
    proof_a = h.csrf()["X-CSRF-Token"]
    cookies_a = dict(h.client.cookies)
    h.client.cookies.clear()
    owner_b = h.account("b@example.com")
    assert post(h, payload()).status_code == 201
    proof_b = h.csrf()["X-CSRF-Token"]
    cookies_b = dict(h.client.cookies)
    h.client.cookies.clear()
    h.client.cookies.update(cookies_a)
    assert h.client.get("/api/v1/me").json()["id"] == owner_a
    h.client.cookies.clear()
    h.client.cookies.update(cookies_b)
    # GETs normally omit Origin. Expected owner also binds CSRF-acquisition races.
    for proof in (proof_a, proof_b):
        response = h.client.get(PATH, headers={"X-CSRF-Token": proof, "X-Account-ID": owner_a})
        assert response.status_code == 403
        assert response.json() == {"detail": "요청을 확인할 수 없습니다."}
    valid = h.client.get(PATH, headers={"X-CSRF-Token": proof_b, "X-Account-ID": owner_b})
    assert valid.status_code == 200 and len(valid.json()["items"]) == 1
    h.client.cookies.clear()
    h.client.cookies.update(cookies_a)
    assert h.client.get("/api/v1/me").json()["id"] == owner_a
    assert h.client.get(PATH).json() == {"items": [], "has_more": False}
    assert h.client.get(
        PATH, headers={"X-CSRF-Token": proof_a, "X-Account-ID": owner_a}
    ).json() == {"items": [], "has_more": False}


@pytest.mark.parametrize(
    "headers",
    [
        {"X-CSRF-Token": "a" * 64},
        {"X-Account-ID": "missing"},
        {"X-CSRF-Token": "bad", "X-Account-ID": "missing"},
    ],
)
def test_invalid_read_binding_does_not_renew_session(harness, headers):
    h = harness
    h.account()
    with h.engine.connect() as connection:
        before = connection.execute(select(sessions.c.last_seen_at)).scalars().all()
    h.clock.now += timedelta(seconds=10)
    response = h.client.get(PATH, headers=headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "요청을 확인할 수 없습니다."}
    with h.engine.connect() as connection:
        assert connection.execute(select(sessions.c.last_seen_at)).scalars().all() == before


def test_read_binding_does_not_replace_authentication(harness):
    assert (
        harness.client.get(
            PATH, headers={"X-CSRF-Token": "a" * 64, "X-Account-ID": "other"}
        ).status_code
        == 401
    )


def test_valid_csrf_only_get_remains_compatible_without_origin(harness):
    h = harness
    h.account()
    response = h.client.get(PATH, headers={"X-CSRF-Token": h.csrf()["X-CSRF-Token"]})
    assert response.status_code == 200
    assert response.json() == {"items": [], "has_more": False}
