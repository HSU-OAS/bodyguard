"""FR-U-04/FR-R-01: real POST session binding; synthetic accounts and summaries."""

from sqlalchemy import func, select

from app.db import minute_summaries
from tests.test_summaries import PATH, payload


def test_post_cookie_b_proof_b_expected_a_cannot_write_b(harness):
    h = harness
    a = h.account("upload-a@example.com")
    cookie_a = dict(h.client.cookies)
    h.client.cookies.clear()
    b = h.account("upload-b@example.com")
    proof_b = h.csrf()
    cookie_b = dict(h.client.cookies)
    h.client.cookies.clear()
    h.client.cookies.update(cookie_a)
    assert h.client.get("/api/v1/me").json()["id"] == a
    h.client.cookies.clear()
    h.client.cookies.update(cookie_b)
    response = h.client.post(
        PATH + "/batch", headers={**proof_b, "X-Account-ID": a}, json={"items": [payload()]}
    )
    assert response.status_code == 403
    with h.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(minute_summaries)) == 0
    accepted = h.client.post(
        PATH + "/batch", headers={**proof_b, "X-Account-ID": b}, json={"items": [payload()]}
    )
    assert accepted.status_code == 201


def test_legacy_post_without_owner_hint_retains_identical_retry(harness):
    h = harness
    h.account()
    headers = h.csrf()
    first = h.client.post(PATH + "/batch", headers=headers, json={"items": [payload()]})
    second = h.client.post(PATH + "/batch", headers=headers, json={"items": [payload()]})
    assert first.status_code == 201 and second.status_code == 200
    assert first.json() == second.json()
