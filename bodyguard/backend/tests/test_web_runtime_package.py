"""NFR-08: initial missing-file red, not a container/runtime success claim."""

from pathlib import Path

import pytest

PACKAGE = Path(__file__).parents[2]


@pytest.mark.parametrize(
    "relative",
    [
        "backend/Dockerfile",
        "backend/.dockerignore",
        "frontend/Dockerfile",
        "frontend/.dockerignore",
        "deploy/nginx.conf",
    ],
)
def test_web_runtime_required_package_files_exist(relative: str) -> None:
    assert (PACKAGE / relative).is_file(), f"Missing runtime package file: {relative}"
