"""NFR-08/FR-U-04: native Compose parsing/ASGI boundary, NOT Docker/NGINX/TLS execution."""

import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
from uvicorn import Config

COMPOSE = Path(__file__).parents[1] / "compose.web.yaml"


@pytest.fixture(scope="module")
def parsed(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    owned = tmp_path_factory.mktemp("bodyguard-package-contract")
    compose = shutil.which("docker-compose")
    docker = shutil.which("docker")
    assert compose or docker, (
        "Docker Compose CLI required; missing CLI is not a passing runtime test"
    )
    # No auto dotenv/service env resolution, user Docker credentials or live engine access.
    environment = {
        "PATH": os.environ.get("PATH", ""),
        "DOCKER_CONFIG": str(owned / "docker-config"),
        "BODYGUARD_WEB_IMAGE": "bodyguard-web-parser-test",
        "BODYGUARD_API_IMAGE": "bodyguard-api-parser-test",
        "BODYGUARD_WEB_PORT": "58443",
        "BODYGUARD_TLS_CERT_FILE": str(owned / "cert.pem"),
        "BODYGUARD_TLS_KEY_FILE": str(owned / "key.pem"),
        "BODYGUARD_RUNTIME_ENV_FILE": str(owned / "runtime.conf"),
    }
    executable = [compose] if compose else [docker, "compose"]
    command = [
        *executable,
        "--env-file",
        os.devnull,
        "--project-name",
        "bodyguard-s5-parse-only",
        "-f",
        str(COMPOSE),
        "config",
        "--no-env-resolution",
        "--format",
        "json",
    ]
    result = subprocess.run(command, env=environment, capture_output=True, timeout=10, check=False)
    assert result.returncode == 0, "Native Compose parser failed (no credentials/config printed)"
    parsed: dict[str, Any] = json.loads(result.stdout)
    missing = subprocess.run(
        command,
        env={"PATH": environment["PATH"], "DOCKER_CONFIG": environment["DOCKER_CONFIG"]},
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert missing.returncode != 0, "Required package inputs were silently defaulted"
    return parsed


def test_native_compose_preserves_local_only_services(parsed: dict[str, Any]) -> None:
    assert set(parsed["services"]) == {"web", "api"}
    assert not parsed.get("volumes")
    web, api = parsed["services"]["web"], parsed["services"]["api"]
    assert len(web["ports"]) == 1
    assert web["ports"][0]["host_ip"] == "127.0.0.1"
    assert web["ports"][0]["target"] == 8443
    assert web["ports"][0]["published"] == "58443"
    assert api["network_mode"] == "service:web"
    assert not api.get("ports") and not api.get("networks")
    assert api["depends_on"]["web"]["restart"] is True
    assert api["environment"] == {
        "BODYGUARD_ENVIRONMENT": "production",
        "BODYGUARD_ORIGIN": "https://bodyguard.test:58443",
    }
    assert len(api["env_file"]) == 1
    for service in (web, api):
        assert service["read_only"] is True
        assert service["cap_drop"] == ["ALL"]
        assert service["security_opt"] == ["no-new-privileges:true"]
        assert not service.get("container_name")
        assert not service.get("privileged")
    assert len(web["volumes"]) == 3
    for mount in web["volumes"]:
        assert mount["type"] == "bind"
        assert mount["read_only"] is True
        assert mount["bind"]["create_host_path"] is False


def test_native_compose_keeps_one_explicit_proxy_peer(parsed: dict[str, Any]) -> None:
    command = parsed["services"]["api"]["command"]
    assert command[:5] == [
        "/opt/bodyguard/.venv/bin/python",
        "-m",
        "uvicorn",
        "app.main:create_app",
        "--factory",
    ]
    assert command[command.index("--host") + 1] == "127.0.0.1"
    assert "--forwarded-allow-ips=127.0.0.1" in command
    assert "--proxy-headers" in command and "--no-access-log" in command
    assert "--no-server-header" in command
    assert not any("alembic" in item or "tests." in item for item in command)


@pytest.mark.parametrize("peer", ["127.0.0.1", "::1", "198.51.100.17", "172.18.0.3", None])
def test_configured_native_uvicorn_rejects_non_loopback_proxy_claims(
    parsed: dict[str, Any], peer: str | None
) -> None:
    command = parsed["services"]["api"]["command"]
    allowed = next(item.split("=", 1)[1] for item in command if item.startswith("--forwarded-"))
    observed: dict[str, Any] = {}

    async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        observed.update(scope)
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    config = Config(
        app,
        interface="asgi3",
        proxy_headers="--proxy-headers" in command,
        forwarded_allow_ips=allowed,
        access_log=False,
        log_config=None,
    )
    config.load()
    original_client = (peer, 50000) if peer else None
    scope = {
        "type": "http",
        "http_version": "1.1",
        "scheme": "http",
        "method": "GET",
        "path": "/synthetic-boundary-only",
        "root_path": "",
        "query_string": b"",
        "headers": [(b"x-forwarded-for", b"203.0.113.9"), (b"x-forwarded-proto", b"https")],
        "client": original_client,
        "server": ("127.0.0.1", 8000),
    }
    messages: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        messages.append(message)

    asyncio.run(config.loaded_app(scope, receive, send))
    assert messages[0]["status"] == 204
    if peer == "127.0.0.1":
        assert observed["client"] == ("203.0.113.9", 0)
        assert observed["scheme"] == "https"
    else:
        assert observed["client"] == original_client
        assert observed["scheme"] == "http"
