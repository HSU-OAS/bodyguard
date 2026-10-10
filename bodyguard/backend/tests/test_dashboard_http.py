"""FR-R-03/FR-U-04: owned loopback HTTP/SQL; no browser or real mail."""

import socket
import threading
import time

import httpx2
import uvicorn

from app.main import create_app
from tests.test_dashboard import PATH, QUERY
from tests.test_summaries import payload, post


def test_actual_http_owned_aggregate_binding_and_revocation(harness):
    h = harness
    owner = h.account()
    assert post(h, payload(58), payload(59)).status_code == 201
    headers = {**h.csrf(), "X-Account-ID": owner}
    # Only synthetic cookie values in test memory, never attachments/log output.
    cookies = dict(h.client.cookies)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
        server = uvicorn.Server(
            uvicorn.Config(
                create_app(
                    h.settings,
                    h.engine,
                    h.mail,
                    h.clock,
                    reset_mail=h.mail,
                    withdraw_mail=h.mail,
                ),
                host="127.0.0.1",
                port=port,
                access_log=False,
                proxy_headers=False,
                log_level="warning",
            )
        )
        worker = threading.Thread(target=server.run, kwargs={"sockets": [listener]})
        worker.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started and worker.is_alive() and time.monotonic() < deadline:
                time.sleep(0.05)
            assert server.started
            with httpx2.Client(
                base_url=f"http://127.0.0.1:{port}",
                cookies=cookies,
                timeout=10,
                trust_env=False,
                follow_redirects=False,
            ) as client:
                response = client.get(PATH, params=QUERY, headers=headers)
                assert response.status_code == 200
                row = response.json()
                assert row["totals"]["minutes"] == 2
                assert row["totals"]["measured_sec"] == 60
                assert row["provenance"] == "client-reported" and row["notifications"] is None
                assert response.headers["cache-control"] == "no-store"
                assert response.headers["referrer-policy"] == "no-referrer"
                assert "user_id" not in row and "email" not in row
                assert (
                    client.get(
                        PATH, params=QUERY, headers={**headers, "X-Account-ID": "not-the-owner"}
                    ).status_code
                    == 403
                )
                assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
                # Explicit original cookie verifies server revocation, not just cookie removal.
                client.cookies.update(cookies)
                assert client.get(PATH, params=QUERY, headers=headers).status_code == 401
        finally:
            server.should_exit = True
            worker.join(timeout=10)
            assert not worker.is_alive(), "Owned HTTP server did not stop"
