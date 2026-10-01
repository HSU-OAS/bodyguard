"""FR-U-02/03/04: real HTTP/SQL browser harness; only mail delivery is simulated."""

import argparse
import json
import os
import secrets
import socket
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import uvicorn
from sqlalchemy import text

from app.config import Settings
from app.main import create_app
from tests.conftest import test_database


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("account", "password"), nargs="?", default="account")
    args = parser.parse_args()
    # Bind before touching data; never reuse a user's server on this port.
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 8000))
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
            server = uvicorn.Server(
                uvicorn.Config(
                    create_app(settings, db, mail=mail, reset_mail=mail),
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
                        f"test-results/{args.suite}",
                    ],
                    cwd=Path(__file__).resolve().parents[2] / "frontend",
                    env={**os.environ, "BODYGUARD_TEST_MAILBOX": str(mailbox)},
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
