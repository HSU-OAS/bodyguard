"""FR-U-01~04: real HTTP/SQL; mail/Google and optional server clock are simulated."""

import argparse
import json
import os
import secrets
import socket
import subprocess
import tempfile
import threading
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs

import httpx2
import uvicorn
from joserfc.jwk import RSAKey
from pydantic import SecretStr
from sqlalchemy import text

from app.config import Settings
from app.main import create_app
from tests.conftest import Harness, test_database
from tests.test_google_auth import CLIENT_ID, Provider


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "suite",
        choices=("account", "password", "google", "records", "design"),
        nargs="?",
        default="account",
    )
    args = parser.parse_args()
    # Bind before touching data; never reuse a user's server on this port.
    with socket.socket() as listener, socket.socket() as blocked_proxy:
        # Reuse a closed test listener's TIME_WAIT, never another live listener.
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("127.0.0.1", 8000))
        # Native browser egress sink: reserve a port without listening, so external
        # traffic is refused even if a route handler misses a redirected request.
        blocked_proxy.bind(("127.0.0.1", 0))
        proxy_url = f"http://127.0.0.1:{blocked_proxy.getsockname()[1]}"
        with (
            test_database() as db,
            tempfile.TemporaryDirectory(
                prefix="bodyguard-browser-", dir="/private/tmp"
            ) as temporary,
        ):
            with db.begin() as connection:
                connection.execute(
                    text("TRUNCATE sessions, signup_challenges, auth_limits, users CASCADE")
                )
            mailbox = Path(temporary) / "mailbox.json"
            mailbox.write_text("{}")
            mailbox.chmod(0o600)

            mail_lock = threading.Lock()

            def mail(email: str, code: str) -> None:
                # Synthetic test credentials only; no HTTP outbox endpoint or real SMTP.
                with mail_lock:
                    values = json.loads(mailbox.read_text())
                    values[email] = code
                    pending = Path(temporary) / "mailbox.next"
                    pending.write_text(json.dumps(values))
                    pending.chmod(0o600)
                    pending.replace(mailbox)

            settings = Settings(
                environment="test",
                database_url=db.url.render_as_string(hide_password=False),
                security_key=secrets.token_urlsafe(32),
                origin="http://localhost:4173",
                smtp_username=None,
                smtp_password=None,
            )
            google_file = Path(temporary) / "google.json"
            google_transport = None
            clock = None
            record_clock_file = Path(temporary) / "record-clock.json"
            if args.suite == "records":
                # FR-U-05: private test IPC only; not a public clock-control endpoint.
                record_clock_file.write_text('{"offset_seconds":0}')
                record_clock_file.chmod(0o600)

                def record_clock() -> datetime:
                    offset = json.loads(record_clock_file.read_text())["offset_seconds"]
                    return datetime.now(UTC) + timedelta(seconds=offset)

                clock = record_clock
            if args.suite == "google":
                # Test-only private IPC: synthetic responses/clock, never a public endpoint.
                google_file.write_text('{"offset_seconds":0,"responses":{}}')
                google_file.chmod(0o600)
                settings = settings.model_copy(
                    update={
                        "google_client_id": CLIENT_ID,
                        "google_client_secret": SecretStr("synthetic-client-secret-never-real"),
                    }
                )
                h = Harness(db)
                h.client.close()
                h.settings = settings
                provider = Provider(h, RSAKey.generate_key(2048, parameters={"kid": "fixture"}))

                def browser_clock() -> datetime:
                    values = json.loads(google_file.read_text())
                    return datetime.now(UTC) + timedelta(seconds=values["offset_seconds"])

                def google_response(request: httpx2.Request) -> httpx2.Response:
                    if request.url.path == "/token":
                        values = parse_qs(request.content.decode())
                        raw_code = values["code"][0]
                        fixture = json.loads(google_file.read_text())["responses"][raw_code]
                        provider.codes[raw_code] = (
                            fixture["challenge"],
                            fixture["nonce"],
                            fixture["sub"],
                        )
                        provider.email = fixture["email"]
                        provider.fault = fixture.get("fault", "")
                    return provider.handle(request)

                google_transport = httpx2.MockTransport(google_response)
                clock = browser_clock
            server = uvicorn.Server(
                uvicorn.Config(
                    create_app(
                        settings,
                        db,
                        mail=mail,
                        reset_mail=mail,
                        clock=clock,
                        google_transport=google_transport,
                    ),
                    host="127.0.0.1",
                    port=8000,
                    access_log=False,
                    proxy_headers=False,
                    log_level="warning",
                )
            )
            worker = threading.Thread(target=server.run, kwargs={"sockets": [listener]})
            worker.start()
            try:
                for _ in range(100):
                    if server.started:
                        break
                    if not worker.is_alive():
                        raise RuntimeError("Browser harness server failed")
                    time.sleep(0.05)
                else:
                    raise RuntimeError("Browser harness server did not start")
                # FR-R-03/FR-V-01: records/design runs preserve every earlier result.
                output = (
                    f"test-results/{args.suite}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}"
                    if args.suite in ("records", "design")
                    else f"test-results/{args.suite}"
                )
                result = subprocess.run(
                    [
                        "pnpm",
                        "exec",
                        "playwright",
                        "test",
                        f"{args.suite}.spec.ts",
                        "--config",
                        "playwright.account.config.ts",
                        "--output",
                        output,
                    ],
                    cwd=Path(__file__).resolve().parents[2] / "frontend",
                    env={
                        **os.environ,
                        "BODYGUARD_TEST_MAILBOX": str(mailbox),
                        "BODYGUARD_TEST_GOOGLE_FIXTURE": str(google_file),
                        "BODYGUARD_TEST_RECORD_CLOCK": str(record_clock_file),
                        "BODYGUARD_TEST_BLOCKED_PROXY": proxy_url,
                        "BODYGUARD_TEST_RECORDS_REPORT": (
                            f"{output}/report.json" if args.suite in ("records", "design") else ""
                        ),
                    },
                    check=False,
                )
                return result.returncode
            finally:
                server.should_exit = True
                worker.join(timeout=10)
                if worker.is_alive():
                    raise RuntimeError("Browser test server did not stop")


if __name__ == "__main__":
    raise SystemExit(main())
