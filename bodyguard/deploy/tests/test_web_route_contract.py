"""FR-U-04/NFR-08: current route/config source contract, NOT actual NGINX routing."""

import re
from pathlib import Path

import pytest

PACKAGE = Path(__file__).parents[2]
PRODUCTION_PATHS = {
    "/",
    "/help",
    "/data",
    "/login",
    "/signup",
    "/password/forgot",
    "/password/reset",
    "/start",
    "/account",
    "/account/notifications",
    "/account/delete",
    "/records",
    "/posture-records",
    "/records/:recordId",
    "/explore",
}


def spa_pattern() -> re.Pattern[str]:
    """Only the current simple anchored subset; this does not emulate NGINX/PCRE."""
    source = (PACKAGE / "deploy/nginx.conf").read_text()
    candidates = re.findall(r"location ~ (\S+)\s*\{\s*try_files /index\.html =404;\s*\}", source)
    assert len(candidates) == 1, "Expected one explicit production SPA location"
    assert "location = / { try_files /index.html =404; }" in source
    assert "location / { return 404; }" in source
    return re.compile(candidates[0])


def test_current_frontend_route_inventory_is_explicit() -> None:
    app = (PACKAGE / "frontend/src/App.tsx").read_text()
    declared = set(re.findall(r'<Route\s+path="([^"]+)"', app))
    production = {path for path in declared if path != "*" and not path.startswith("/dev/")}
    assert production == PRODUCTION_PATHS, "Review a changed production route before packaging"


@pytest.mark.parametrize("path", sorted(PRODUCTION_PATHS - {"/"}))
def test_spa_source_pattern_covers_each_current_direct_route(path: str) -> None:
    concrete = path.replace(":recordId", "synthetic-record")
    assert spa_pattern().fullmatch(concrete), "Production direct route missing from package"


@pytest.mark.parametrize(
    "path",
    [
        "/api",
        "/api/auth/me",
        "/api/minute-summaries",
        "/api/missing",
        "/dev/select",
        "/dev/measure",
        "/dev/avatar",
        "/assets/missing.js",
        "/models/prototype.glb",
        "/mediapipe/vision_wasm_internal.wasm",
        "/.env",
        "/unknown",
        "/account/missing",
        "/account/notifications/extra",
        "/posture-records/missing",
        "/records/a/b",
    ],
)
def test_spa_source_pattern_does_not_admit_api_dev_or_unknown_paths(path: str) -> None:
    assert spa_pattern().fullmatch(path) is None
