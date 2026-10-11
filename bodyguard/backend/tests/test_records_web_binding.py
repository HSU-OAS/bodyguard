"""FR-R-03/FR-U-04/05: real owned SQL and sessions, synthetic summaries only."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.db import sessions, stretch_records
from tests.test_record_deletion import period, preview
from tests.test_records import payload

PATH = "/api/v1/records/stretch"


@pytest.mark.parametrize("operation", ["list", "detail", "save", "preview", "delete"])
def test_record_operations_reject_old_account_with_current_cookie(harness, operation):
    h = harness
    a = h.account("records-a@example.com")
    proof_a, cookie_a = h.csrf(), dict(h.client.cookies)
    h.client.cookies.clear()
    b = h.account("records-b@example.com")
    body = payload(h)
    assert h.client.post(PATH, headers=h.csrf(), json=body).status_code == 201
    proof_b = h.csrf()
    deletion = preview(h)
    with h.engine.connect() as connection:
        before = connection.execute(select(stretch_records)).mappings().all()
    for proof in (proof_a, proof_b):
        headers = {**proof, "X-Account-ID": a}
        if operation == "list":
            response = h.client.get(PATH, headers=headers)
        elif operation == "detail":
            response = h.client.get(PATH + "/" + body["id"], headers=headers)
        elif operation == "save":
            response = h.client.post(PATH, headers=headers, json=payload(h))
        elif operation == "preview":
            response = h.client.post(PATH + "/delete-preview", headers=headers, json=period(h))
        else:
            response = h.client.post(
                PATH + "/delete",
                headers=headers,
                json={**deletion, "confirmation": "delete-stretch-records"},
            )
        assert response.status_code == 403
        with h.engine.connect() as connection:
            assert connection.execute(select(stretch_records)).mappings().all() == before
    assert h.client.get(PATH, headers={**proof_b, "X-Account-ID": b}).json()["items"]
    assert h.client.get(PATH).json()["items"]
    h.client.cookies.clear()
    h.client.cookies.update(cookie_a)
    assert h.client.get(PATH, headers={**proof_a, "X-Account-ID": a}).json()["items"] == []
    assert h.client.get(PATH + "/" + body["id"]).status_code == 404


@pytest.mark.parametrize("suffix", ["", "/00000000-0000-4000-8000-000000000001"])
def test_invalid_record_binding_cannot_renew_session_or_authorize_guest(harness, suffix):
    h = harness
    assert h.client.get(PATH + suffix, headers={"X-Account-ID": "other"}).status_code == 401
    h.account()
    proof = h.csrf()
    with h.engine.connect() as connection:
        before = connection.execute(select(sessions.c.last_seen_at)).scalars().all()
    h.clock.now += timedelta(seconds=10)
    assert (
        h.client.get(PATH + suffix, headers={**proof, "X-Account-ID": "other"}).status_code == 403
    )
    with h.engine.connect() as connection:
        assert connection.execute(select(sessions.c.last_seen_at)).scalars().all() == before


def test_records_openapi_documents_optional_binding(harness):
    paths = harness.client.app.openapi()["paths"]
    for path, method in (
        (PATH, "get"),
        (PATH + "/{record_id}", "get"),
        (PATH, "post"),
        (PATH + "/delete-preview", "post"),
        (PATH + "/delete", "post"),
    ):
        headers = {
            p["name"]: p for p in paths[path][method].get("parameters", []) if p["in"] == "header"
        }
        assert set(headers) == {"X-CSRF-Token", "X-Account-ID"}
        assert all(not item["required"] for item in headers.values())
