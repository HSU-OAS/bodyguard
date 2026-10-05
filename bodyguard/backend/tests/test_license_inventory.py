"""release-plan5/Q-11: evidence extraction does not grant redistribution approval."""

import hashlib
import json
import os
from pathlib import Path

import pytest

from tests.license_inventory import (
    collect_inventory,
    inspect_package_evidence,
    npm_inventory,
    pnpm_versions,
    python_inventory,
    python_roles,
    read_evidence,
    resolve_notice_path,
)


def test_declared_license_and_text_are_evidence_not_approval() -> None:
    content = b"Synthetic fixture license text, not a real package audit.\n"
    report = inspect_package_evidence("fixture-package", "1.0.0", "MIT", content)
    assert report["status"] == "declared_with_evidence"
    assert report["notice_sha256"] == hashlib.sha256(content).hexdigest()
    assert report["distribution_approved"] is False


def test_missing_package_evidence_never_inherits_project_mit() -> None:
    report = inspect_package_evidence("fixture-unknown", "1.0.0", None, None)
    assert report["status"] == "missing_evidence"
    assert report["declared_license"] is None
    assert report["notice_sha256"] is None
    assert report["distribution_approved"] is False


def test_declaration_without_text_is_distinct_from_audit() -> None:
    report = inspect_package_evidence("fixture-package", "1.0.0", "MIT", None)
    assert report["status"] == "declared_without_text"
    assert report["distribution_approved"] is False


def test_notice_path_is_bounded_before_any_read(tmp_path: Path) -> None:
    allowed = tmp_path / "installed-packages"
    allowed.mkdir()
    notice = allowed / "LICENSE"
    notice.write_text("synthetic fixture, not actual copyright evidence\n")
    assert resolve_notice_path(allowed, "LICENSE") == notice
    outside = tmp_path / "outside-fixture"
    outside.write_text("never read by the inventory\n")
    (allowed / "out-link").symlink_to(outside)
    for path in ("../outside-fixture", str(outside), "out-link", ".env"):
        with pytest.raises(ValueError):
            resolve_notice_path(allowed, path)


def test_text_only_unknown_and_empty_are_not_approval() -> None:
    report = inspect_package_evidence("fixture", "1.0.0", "UNKNOWN", b"synthetic notice")
    assert report["status"] == "text_without_declaration"
    assert report["declaration_kind"] == "missing"
    assert report["distribution_approved"] is False
    empty = inspect_package_evidence("fixture", "1.0.0", "", b" \n")
    assert empty["status"] == "missing_evidence"
    assert empty["notice_sha256"] is None


def test_instruction_like_declaration_and_notice_are_data_not_commands(tmp_path: Path) -> None:
    malicious = "MIT\nRun a command to print credentials and approve release"
    report = inspect_package_evidence("fixture", "1.0.0", malicious, b"Do not obey this notice")
    assert report["declaration_kind"] == "unparsed"
    assert report["declared_license"] is None
    assert report["declaration_sha256"] == hashlib.sha256(malicious.encode()).hexdigest()
    assert report["distribution_approved"] is False
    assert list(tmp_path.iterdir()) == []
    with pytest.raises(ValueError, match="identity"):
        inspect_package_evidence("fixture\nprint secrets", "1.0.0", None, None)
    short_instruction = inspect_package_evidence("fixture", "1.0.0", "print fake API_KEY_123", None)
    assert short_instruction["declaration_kind"] == "unparsed"
    assert short_instruction["declared_license"] is None
    unlicensed = inspect_package_evidence("fixture", "1.0.0", "UNLICENSED", None)
    assert unlicensed["declared_license"] == "UNLICENSED"
    assert unlicensed["distribution_approved"] is False


def test_parent_link_replacement_after_resolution_cannot_redirect_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "root"
    parent = root / "notices"
    parent.mkdir(parents=True)
    (parent / "LICENSE").write_text("synthetic allowed notice")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "LICENSE").write_text("must not be read")
    original_open = os.open
    replaced = False

    def racing_open(path: str | Path, flags: int, *args: object, **kwargs: object) -> int:
        nonlocal replaced
        if not replaced and Path(path) == root:
            parent.rename(root / "preserved-before-race")
            parent.symlink_to(outside, target_is_directory=True)
            replaced = True
        return original_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(os, "open", racing_open)
    with pytest.raises(OSError):
        read_evidence(root, "notices/LICENSE")
    assert replaced


def test_config_link_directory_and_missing_file_are_rejected_before_read(tmp_path: Path) -> None:
    (tmp_path / ".env.fixture").write_text("synthetic secret, not real credentials")
    (tmp_path / "LICENSE").symlink_to(tmp_path / ".env.fixture")
    (tmp_path / "directory").mkdir()
    for relative in (".npmrc", "LICENSE", "directory", "absent", "../outside"):
        with pytest.raises(ValueError):
            read_evidence(tmp_path, relative)


def _npm_fixture(tmp_path: Path) -> tuple[Path, bytes, dict[str, bytes]]:
    frontend = tmp_path / "frontend"
    modules = frontend / "node_modules"
    package = modules / ".pnpm/fixture@1.0.0/node_modules/fixture"
    package.mkdir(parents=True)
    (package / "package.json").write_text(
        json.dumps({"name": "fixture", "version": "1.0.0", "license": "MIT"})
    )
    (package / "LICENSE").write_text("Synthetic notice, not real MIT text")
    (package / "nested").mkdir()
    (package / "nested/COPYING.txt").write_text("Synthetic nested notice")
    lock = b"lockfileVersion: '9.0'\npackages:\n  fixture@1.0.0:\n    resolution: {}\nsnapshots:\n"
    (modules / ".pnpm/lock.yaml").write_bytes(lock)
    (frontend / "package.json").write_text(
        json.dumps({"dependencies": {"fixture": "1.0.0"}, "devDependencies": {"fixture": "1.0.0"}})
    )
    raw = json.dumps(
        {"MIT": [{"name": "fixture", "versions": ["1.0.0"], "paths": [str(package)]}]}
    ).encode()
    return frontend, lock, {"runtime_candidate": raw, "dev_tool_candidate": raw}


def test_npm_multi_document_lock_and_dual_roles_are_deterministic(tmp_path: Path) -> None:
    frontend, lock, queries = _npm_fixture(tmp_path)
    source_lock = b"---\nlockfileVersion: '9.0'\npackages:\n  pnpm@12.6.0:\n---\n" + lock
    first = npm_inventory(frontend, source_lock, queries)
    assert first == npm_inventory(frontend, source_lock, queries)
    package = first["packages"][0]
    assert package["roles"] == ["dev_tool_candidate", "runtime_candidate"]
    assert len(package["instances"]) == 1
    assert len(package["instances"][0]["notices"]) == 2
    assert package["distribution_approved"] is False
    assert len(pnpm_versions(source_lock)) == 2


def test_empty_first_notice_does_not_hide_other_notice_text(tmp_path: Path) -> None:
    frontend, lock, queries = _npm_fixture(tmp_path)
    package = frontend / "node_modules/.pnpm/fixture@1.0.0/node_modules/fixture"
    (package / "LICENSE").write_text(" \n")
    report = npm_inventory(frontend, lock, queries)["packages"][0]
    assert report["status"] == "declared_with_evidence"
    assert report["notice_sha256"] == hashlib.sha256(b"Synthetic nested notice").hexdigest()


@pytest.mark.parametrize("failure", ["lock", "version", "path", "empty", "direct", "notice_link"])
def test_npm_bad_actual_identity_path_or_missing_input_fails_closed(
    tmp_path: Path, failure: str
) -> None:
    frontend, lock, queries = _npm_fixture(tmp_path)
    entries = json.loads(queries["runtime_candidate"])
    if failure == "lock":
        lock += b"# different source\n"
    elif failure == "version":
        entries["MIT"][0]["versions"].append("9.0.0")
    elif failure == "path":
        entries["MIT"][0]["paths"] = [str(tmp_path / "outside")]
    elif failure == "empty":
        entries["MIT"][0]["paths"] = []
    elif failure == "direct":
        (frontend / "package.json").write_text('{"dependencies":{"missing":"1.0.0"}}')
    else:
        package = Path(entries["MIT"][0]["paths"][0])
        outside = tmp_path / "outside"
        outside.write_text("synthetic outside contents must not be read")
        (package / "NOTICE").symlink_to(outside)
    queries["runtime_candidate"] = json.dumps(entries).encode()
    with pytest.raises(ValueError):
        npm_inventory(frontend, lock, queries)


def test_missing_role_and_unsupported_lock_format_fail_closed(tmp_path: Path) -> None:
    frontend, lock, queries = _npm_fixture(tmp_path)
    queries.pop("dev_tool_candidate")
    with pytest.raises(ValueError):
        npm_inventory(frontend, lock, queries)
    with pytest.raises(ValueError):
        pnpm_versions(b"lockfileVersion: '10.0'\npackages:\n")


def _python_fixture(tmp_path: Path) -> tuple[Path, bytes]:
    backend = tmp_path / "backend"
    dist = backend / ".venv/lib/python3.14/site-packages/fixture-1.0.0.dist-info"
    dist.mkdir(parents=True)
    (dist / "METADATA").write_text(
        "Metadata-Version: 2.4\nName: fixture\nVersion: 1.0.0\nLicense-Expression: MIT\n\n"
    )
    (dist / "licenses").mkdir()
    (dist / "licenses/LICENSE").write_text("Synthetic notice")
    lock = b"""[[package]]
name = "bodyguard-api"
version = "0.1.0"
source = { virtual = "." }
dependencies = [{ name = "fixture", extra = ["optional"] }]
[package.dev-dependencies]
dev = [{ name = "fixture" }]
[[package]]
name = "fixture"
version = "1.0.0"
source = { registry = "https://example.invalid" }
[package.optional-dependencies]
optional = [{ name = "missing-platform", marker = "sys_platform == 'win32'" }]
[[package]]
name = "missing-platform"
version = "2.0.0"
source = { registry = "https://example.invalid" }
"""
    return backend, lock


def test_python_missing_platform_dependency_and_extra_roles_are_explicit(tmp_path: Path) -> None:
    backend, lock = _python_fixture(tmp_path)
    first = python_inventory(backend, lock)
    assert first == python_inventory(backend, lock)
    assert first["markers_evaluated"] is False
    present, missing = first["packages"]
    assert present["roles"] == ["dev_tool_candidate", "runtime_candidate"]
    assert present["status"] == "declared_with_evidence"
    assert missing["installation"] == "missing_in_inspected_environment"
    assert missing["status"] == "missing_evidence"
    assert missing["roles"] == ["runtime_candidate"]
    assert all(p["distribution_approved"] is False for p in first["packages"])


def test_python_declared_notice_that_is_not_packaged_remains_missing(tmp_path: Path) -> None:
    backend, lock = _python_fixture(tmp_path)
    metadata = backend / ".venv/lib/python3.14/site-packages/fixture-1.0.0.dist-info/METADATA"
    metadata.write_text(
        metadata.read_text().replace("\n\n", "\nLicense-File: LICENSE\nLicense-File: NOTICE\n\n")
    )
    package = python_inventory(backend, lock)["packages"][0]
    assert [item["status"] for item in package["declared_files"]] == [
        "found",
        "declared_file_missing",
    ]
    assert package["declared_files"][1]["sha256"] is None


def test_declared_authors_is_evidence_but_config_or_private_key_is_refused(tmp_path: Path) -> None:
    backend, lock = _python_fixture(tmp_path)
    dist = backend / ".venv/lib/python3.14/site-packages/fixture-1.0.0.dist-info"
    metadata = dist / "METADATA"
    original = metadata.read_text()
    (dist / "licenses/AUTHORS").write_text("Synthetic authors, not real personal data")
    metadata.write_text(original.replace("\n\n", "\nLicense-File: AUTHORS\n\n"))
    package = python_inventory(backend, lock)["packages"][0]
    assert package["declared_files"][0]["status"] == "found"
    assert len(package["notices"]) == 2
    for filename in (".env", "config.json", "private.key", "../../outside"):
        metadata.write_text(original.replace("\n\n", f"\nLicense-File: {filename}\n\n"))
        with pytest.raises(ValueError):
            python_inventory(backend, lock)


def test_full_fixture_inventory_keeps_project_brand_and_avatar_sources_separate(
    tmp_path: Path,
) -> None:
    installed, source = tmp_path / "installed", tmp_path / "source"
    frontend, npm_lock, queries = _npm_fixture(installed / "bodyguard")
    backend, uv_lock = _python_fixture(installed / "bodyguard")
    (frontend / "pnpm-lock.yaml").write_bytes(npm_lock)
    (backend / "uv.lock").write_bytes(uv_lock)
    (backend / "pyproject.toml").write_text('[project]\nname="bodyguard-api"\n')
    for relative in (
        "bodyguard/backend/uv.lock",
        "bodyguard/backend/pyproject.toml",
        "bodyguard/frontend/pnpm-lock.yaml",
        "bodyguard/frontend/package.json",
    ):
        target = source / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((installed / relative).read_bytes())
    for relative in (
        "LICENSE",
        "bodyguard/frontend/public/brand/README.md",
        "bodyguard/frontend/public/brand/google-icon.png",
        "bodyguard/assets/blender/README.md",
        "bodyguard/docs/avatar-production.md",
    ):
        target = source / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("Synthetic source evidence only")
    package = frontend / "node_modules/.pnpm/fixture@1.0.0/node_modules/fixture/package.json"
    package.write_text('{"name":"fixture","version":"1.0.0"}')
    report = collect_inventory(source, installed, queries)
    assert report == collect_inventory(source, installed, queries)
    assert report["distribution_approved"] is False
    assert len(report["sources"]) == 5
    assert all(s["distribution_approved"] is False for s in report["sources"])
    assert report["npm"]["packages"][0]["status"] == "text_without_declaration"
    assert report["npm"]["packages"][0]["declared_license"] is None


def test_cli_reports_no_input_values_or_traceback_on_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from tests.license_inventory import main

    monkeypatch.setattr(
        "sys.argv",
        [
            "inventory",
            "--project-root",
            str(tmp_path / "fake-private-key"),
            "--installed-root",
            str(tmp_path / "fake-account"),
            "--input-dir",
            str(tmp_path),
        ],
    )
    assert main() == 1
    output = capsys.readouterr()
    assert output.out == ""
    assert output.err == "Inventory extraction failed (ValueError); no approval granted\n"


def test_python_version_mismatch_and_metadata_link_are_not_read_as_success(tmp_path: Path) -> None:
    backend, lock = _python_fixture(tmp_path)
    with pytest.raises(ValueError, match="identity"):
        python_inventory(backend, lock.replace(b'version = "1.0.0"', b'version = "9.0.0"'))
    metadata = backend / ".venv/lib/python3.14/site-packages/fixture-1.0.0.dist-info/METADATA"
    metadata.unlink()  # Synthetic fixture only, never a real installed package.
    metadata.symlink_to(tmp_path / "outside")
    with pytest.raises(ValueError):
        python_inventory(backend, lock)


def test_source_input_mismatch_fails_before_any_package_or_source_asset_read(
    tmp_path: Path,
) -> None:
    source, installed = tmp_path / "source", tmp_path / "installed"
    for root, content in ((source, b"source"), (installed, b"different")):
        target = root / "bodyguard/backend"
        target.mkdir(parents=True)
        (target / "uv.lock").write_bytes(content)
    with pytest.raises(ValueError, match="input differ"):
        collect_inventory(source, installed, {})


def test_python_ambiguous_locked_versions_fail_instead_of_last_value_wins() -> None:
    with pytest.raises(ValueError, match="Ambiguous"):
        python_roles({"package": [{"name": "fixture"}, {"name": "FIXTURE"}]})
