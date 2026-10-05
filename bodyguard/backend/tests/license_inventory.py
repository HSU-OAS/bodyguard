"""release-plan5/Q-11/FR-A-02/03: bounded evidence, never legal or release approval.

Reads locked installation metadata without importing audited packages. The pnpm JSON
inputs must come from the separate read-only `licenses list --prod/--dev --json`
commands, not from package scripts. No networking, DB, .blend or rendering here.
"""

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import tomllib
from collections import deque
from email.parser import BytesParser
from pathlib import Path
from typing import Any

MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_PACKAGE_COUNT = 10_000
NAME = re.compile(r"(?:@[a-z0-9._-]+/)?[a-zA-Z0-9._-]{1,200}\Z")
VERSION = re.compile(r"[0-9][a-zA-Z0-9.+_-]{0,100}\Z")
# Display vocabulary only, never a license eligibility/compatibility allowlist.
# Unknown or instruction-like declarations remain hash-only and unparsed.
DISPLAY_LICENSE = (
    r"(?:MIT(?:-0)?|Apache-2\.0|BSD(?:-[234]-Clause)?|ISC|CC0-1\.0|"
    r"LGPL-[23]\.[01]-(?:only|or-later)|GPL-[23]\.0-(?:only|or-later)|"
    r"AGPL-3\.0-(?:only|or-later)|MPL-2\.0|PSF-2\.0|UNLICENSED)"
)
LABEL = re.compile(rf"(?:\(?{DISPLAY_LICENSE}\)?)(?: (?:AND|OR) \(?{DISPLAY_LICENSE}\)?)*\Z")
NOTICE = re.compile(r"(?:licen[cs]e|copying|notice|copyright)(?:[._-].*)?\Z", re.I)
FORBIDDEN = {
    ".npmrc",
    ".pypirc",
    ".netrc",
    ".pgpass",
    ".git",
    "credentials",
    "credentials.json",
    "auth.json",
    "token.json",
    "config.json",
    "id_rsa",
    "id_ed25519",
}


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def resolve_notice_path(allowed_root: Path, relative: str) -> Path:
    """Q-11: reject forbidden paths and escaping links before any content read."""
    candidate = Path(relative)
    if candidate.is_absolute() or not candidate.parts or ".." in candidate.parts:
        raise ValueError("Evidence path must be relative and contained")
    if any(p.lower().startswith(".env") or p.lower() in FORBIDDEN for p in candidate.parts):
        raise ValueError("Authentication/configuration evidence is forbidden")
    root = allowed_root.resolve(strict=True)
    try:
        resolved = (root / candidate).resolve(strict=True)
        local = resolved.relative_to(root)
    except (OSError, ValueError) as from_error:
        raise ValueError("Evidence path missing or outside allowed root") from from_error
    if any(p.lower().startswith(".env") or p.lower() in FORBIDDEN for p in local.parts):
        raise ValueError("Resolved authentication/configuration evidence is forbidden")
    if not resolved.is_file():
        raise ValueError("Evidence must be a regular file")
    return resolved


def read_evidence(root: Path, relative: str) -> bytes:
    resolved = resolve_notice_path(root, relative)
    # Walk relative to an open root descriptor: replacing an intermediate directory
    # with a link after resolution cannot redirect the content read outside the root.
    parts = resolved.relative_to(root.resolve(strict=True)).parts
    parent = os.open(root.resolve(strict=True), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for component in parts[:-1]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            os.close(parent)
            parent = child
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    finally:
        os.close(parent)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_FILE_BYTES:
            raise ValueError("Evidence type/size exceeds bounded reader")
        content = source.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            raise ValueError("Evidence grew beyond bounded reader")
        return content


def inspect_package_evidence(
    name: str, version: str, declaration: str | None, content: bytes | None
) -> dict[str, Any]:
    if not NAME.fullmatch(name) or not VERSION.fullmatch(version):
        raise ValueError("Invalid package identity")
    raw = declaration.strip() if isinstance(declaration, str) else ""
    present = bool(raw and raw.upper() not in {"UNKNOWN", "NONE"})
    readable = present and LABEL.fullmatch(raw) is not None
    text_present = content is not None and bool(content.strip())
    status = {
        (True, True): "declared_with_evidence",
        (True, False): "declared_without_text",
        (False, True): "text_without_declaration",
        (False, False): "missing_evidence",
    }[(present, text_present)]
    return {
        "name": name,
        "version": version,
        "declared_license": raw if readable else None,
        "declaration_kind": "label_unvalidated"
        if readable
        else "unparsed"
        if present
        else "missing",
        "declaration_sha256": sha256(raw.encode()) if raw else None,
        "notice_sha256": sha256(content) if text_present else None,
        "status": status,
        "distribution_approved": False,
    }


def notice_files(root: Path, subtree: str) -> list[dict[str, Any]]:
    """Read only notice-shaped files; no directory symlink traversal or package import."""
    start = (root / subtree).resolve(strict=True)
    try:
        start.relative_to(root.resolve(strict=True))
    except ValueError as error:
        raise ValueError("Notice subtree outside allowed root") from error
    result: list[dict[str, Any]] = []
    inspected = 0
    for directory, dirs, files in os.walk(start, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d != "node_modules" and not d.startswith("."))
        inspected += len(dirs) + len(files)
        if inspected > MAX_PACKAGE_COUNT:
            raise ValueError("Notice tree exceeds bounded enumeration")
        for filename in sorted(files):
            if NOTICE.fullmatch(filename):
                path = (Path(directory) / filename).relative_to(root.resolve()).as_posix()
                content = read_evidence(root, path)
                result.append(
                    {
                        "path": path,
                        "sha256": sha256(content),
                        "bytes": len(content),
                        "nonempty": bool(content.strip()),
                    }
                )
    return sorted(result, key=lambda item: item["path"])


def _first_notice(root: Path, notices: list[dict[str, Any]]) -> bytes | None:
    return next((read_evidence(root, n["path"]) for n in notices if n["nonempty"]), None)


def pnpm_versions(content: bytes) -> set[tuple[str, str]]:
    """Narrow pnpm v9 package-key index, not a general YAML parser/resolver."""
    text = content.decode("utf-8")
    if not re.search(r"(?m)^lockfileVersion: '9\.0'\s*$", text):
        raise ValueError("Unsupported pnpm lock format")
    identities: set[tuple[str, str]] = set()
    in_packages = False
    for line in text.splitlines():
        if line == "packages:":
            in_packages = True
            continue
        if line and not line.startswith(" "):
            in_packages = False
        if not in_packages or not line.startswith("  ") or line.startswith("   "):
            continue
        if not line.endswith(":"):
            raise ValueError("Unsupported pnpm package key")
        key = line[2:-1].strip("'")
        name, separator, version = key.rpartition("@")
        if not separator or not NAME.fullmatch(name) or not VERSION.fullmatch(version):
            raise ValueError("Unsupported pnpm package identity")
        identities.add((name, version))
    if not identities:
        raise ValueError("Empty pnpm package index")
    return identities


def _relative_input(root: Path, raw_path: str) -> str:
    try:
        path = Path(raw_path).relative_to(root.resolve()).as_posix()
    except ValueError as error:
        raise ValueError("pnpm package path outside installation") from error
    # Paths in a published report must not contain arbitrary metadata strings/URL queries.
    if not re.fullmatch(r"[a-zA-Z0-9._+/@()-]+", path):
        raise ValueError("Unreportable package evidence path")
    return path


def npm_inventory(frontend: Path, source_lock: bytes, queries: dict[str, bytes]) -> dict[str, Any]:
    modules = frontend / "node_modules"
    installed_lock = read_evidence(modules, ".pnpm/lock.yaml")
    documents = re.split(rb"(?m)^---[ \t]*\r?\n", source_lock)
    if not any(document.strip() == installed_lock.strip() for document in documents):
        raise ValueError("Installed pnpm lock is not a source lock document")
    locked = pnpm_versions(installed_lock)
    records: dict[tuple[str, str], dict[str, Any]] = {}
    roles = {"runtime_candidate", "dev_tool_candidate"}
    if set(queries) != roles:
        raise ValueError("Both pnpm production and development evidence are required")
    for role, raw in sorted(queries.items()):
        if len(raw) > MAX_FILE_BYTES:
            raise ValueError("pnpm evidence exceeds limit")
        buckets = json.loads(raw)
        if not isinstance(buckets, dict):
            raise ValueError("Invalid pnpm evidence structure")
        if any(not isinstance(bucket, list) for bucket in buckets.values()):
            raise ValueError("Invalid pnpm license buckets")
        entries = [entry for bucket in buckets.values() for entry in bucket]
        if not entries or len(entries) > MAX_PACKAGE_COUNT:
            raise ValueError("Empty or excessive pnpm package evidence")
        for entry in entries:
            if (
                not isinstance(entry, dict)
                or not isinstance(entry.get("paths"), list)
                or not entry["paths"]
                or not isinstance(entry.get("versions"), list)
                or not entry["versions"]
                or any(not isinstance(v, str) for v in entry["versions"])
            ):
                raise ValueError("Invalid pnpm entry")
            observed_versions = set()
            for raw_path in entry["paths"]:
                relative = _relative_input(modules, raw_path)
                metadata_path = relative + "/package.json"
                metadata_raw = read_evidence(modules, metadata_path)
                metadata = json.loads(metadata_raw)
                if not isinstance(metadata, dict):
                    raise ValueError("Invalid npm metadata object")
                name, version = metadata.get("name"), metadata.get("version")
                if (name, version) not in locked or name != entry.get("name"):
                    raise ValueError("npm identity absent from locked installation")
                if version not in entry.get("versions", []):
                    raise ValueError("npm CLI and package metadata version disagree")
                observed_versions.add(version)
                declaration = metadata.get("license")
                if not isinstance(declaration, str):
                    declaration = None
                # Nested bundled notices are included, not just one top-level LICENSE.
                notices = notice_files(modules, relative)
                first = _first_notice(modules, notices)
                report = inspect_package_evidence(name, version, declaration, first)
                key = (name, version)
                if key not in records:
                    records[key] = {**report, "roles": [], "instances": []}
                record = records[key]
                if role not in record["roles"]:
                    record["roles"].append(role)
                instance = {
                    "evidence": report,
                    "metadata_path": metadata_path,
                    "metadata_sha256": sha256(metadata_raw),
                    "notices": notices,
                }
                if instance not in record["instances"]:
                    record["instances"].append(instance)
            if observed_versions != set(entry["versions"]):
                raise ValueError("A pnpm claimed version has no installed metadata")
    manifest = json.loads(read_evidence(frontend, "package.json"))
    for role, field in (
        ("runtime_candidate", "dependencies"),
        ("dev_tool_candidate", "devDependencies"),
    ):
        for name in manifest.get(field, {}):
            if not any(key[0] == name and role in value["roles"] for key, value in records.items()):
                raise ValueError("A direct npm dependency is missing from CLI evidence")
    for record in records.values():
        record["roles"].sort()
        record["instances"].sort(key=lambda instance: instance["metadata_path"])
    return {
        "scope": "installed_pnpm_closures_not_final_bundle_sbom",
        "installed_lock_sha256": sha256(installed_lock),
        "input_sha256": {role: sha256(raw) for role, raw in sorted(queries.items())},
        "packages": [records[key] for key in sorted(records)],
    }


def _normal_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def python_roles(lock: dict[str, Any]) -> dict[str, list[str]]:
    """Include optional-extra and marker edges as a labeled platform superset."""
    packages = {_normal_name(package["name"]): package for package in lock["package"]}
    if len(packages) != len(lock["package"]):
        raise ValueError("Ambiguous Python lock package versions")
    project = packages["bodyguard-api"]
    roles: dict[str, list[str]] = {}
    for role, initial in (
        ("runtime_candidate", project.get("dependencies", [])),
        ("dev_tool_candidate", project.get("dev-dependencies", {}).get("dev", [])),
    ):
        pending = deque(initial)
        seen: set[tuple[str, tuple[str, ...]]] = set()
        while pending:
            edge = pending.popleft()
            name = _normal_name(edge["name"])
            extras = tuple(sorted(edge.get("extra", [])))
            if (name, extras) in seen:
                continue
            seen.add((name, extras))
            package = packages[name]
            if role not in roles.setdefault(name, []):
                roles[name].append(role)
            pending.extend(package.get("dependencies", []))
            for extra in extras:
                pending.extend(package.get("optional-dependencies", {}).get(extra, []))
    return {name: sorted(value) for name, value in roles.items()}


def python_inventory(backend: Path, source_lock: bytes) -> dict[str, Any]:
    site = backend / ".venv/lib/python3.14/site-packages"
    lock = tomllib.loads(source_lock.decode())
    roles = python_roles(lock)
    expected = {
        _normal_name(package["name"]): package
        for package in lock["package"]
        if "virtual" not in package["source"]
    }
    records: dict[str, dict[str, Any]] = {}
    metadata_dirs = sorted(path.name for path in site.iterdir() if path.name.endswith(".dist-info"))
    if not metadata_dirs or len(metadata_dirs) > MAX_PACKAGE_COUNT:
        raise ValueError("Missing or excessive installed Python metadata")
    for directory in metadata_dirs:
        raw = read_evidence(site, directory + "/METADATA")
        metadata = BytesParser().parsebytes(raw, headersonly=True)
        name, version = metadata.get("Name"), metadata.get("Version")
        if not isinstance(name, str) or not isinstance(version, str):
            raise ValueError("Missing Python package identity")
        normal = _normal_name(name)
        if normal not in expected or expected[normal]["version"] != version or normal in records:
            raise ValueError("Python installed identity differs from source lock")
        declaration = metadata.get("License-Expression") or metadata.get("License")
        notices = notice_files(site, directory)
        declared_files = []
        for filename in metadata.get_all("License-File", []):
            candidate = Path(filename)
            if (
                candidate.is_absolute()
                or ".." in candidate.parts
                or not re.fullmatch(r"[a-zA-Z0-9._/-]+", filename)
                or candidate.suffix.lower() in {".key", ".pem", ".p12"}
                or any(
                    p.lower().startswith(".env") or p.lower() in FORBIDDEN for p in candidate.parts
                )
            ):
                raise ValueError("Invalid Python License-File path")
            possible = [directory + "/licenses/" + filename, directory + "/" + filename]
            matched = next((n for n in notices if n["path"] in possible), None)
            if matched is None:
                # License-File may legitimately name AUTHORS or another non-standard
                # notice. Read it only through the same bounded descriptor reader.
                for path in possible:
                    if os.path.lexists(site / path):
                        notice = read_evidence(site, path)
                        matched = {
                            "path": path,
                            "sha256": sha256(notice),
                            "bytes": len(notice),
                            "nonempty": bool(notice.strip()),
                        }
                        notices.append(matched)
                        break
            declared_files.append(
                {
                    "declared_path": filename,
                    "evidence_path": matched["path"] if matched else None,
                    "sha256": matched["sha256"] if matched else None,
                    "status": "found" if matched else "declared_file_missing",
                }
            )
        notices.sort(key=lambda notice: notice["path"])
        first = _first_notice(site, notices)
        records[normal] = {
            **inspect_package_evidence(normal, version, declaration, first),
            "roles": roles.get(normal, ["lock_other"]),
            "installation": "present",
            "metadata_path": directory + "/METADATA",
            "metadata_sha256": sha256(raw),
            "notices": notices,
            "declared_files": declared_files,
        }
    for name in sorted(set(expected) - set(records)):
        records[name] = {
            **inspect_package_evidence(name, expected[name]["version"], None, None),
            "roles": roles.get(name, ["lock_other"]),
            "installation": "missing_in_inspected_environment",
            "metadata_path": None,
            "metadata_sha256": None,
            "notices": [],
            "declared_files": [],
        }
    return {
        "scope": "uv_lock_platform_superset_and_local_installation_not_image_sbom",
        "markers_evaluated": False,
        "packages": [records[name] for name in sorted(records)],
    }


def collect_inventory(
    project_root: Path, installed_root: Path, npm_queries: dict[str, bytes]
) -> dict[str, Any]:
    locks: dict[str, bytes] = {}
    inputs: dict[str, str] = {}
    # Fail before reading packages if source/installation locks or manifests differ.
    for relative in (
        "bodyguard/backend/uv.lock",
        "bodyguard/backend/pyproject.toml",
        "bodyguard/frontend/pnpm-lock.yaml",
        "bodyguard/frontend/package.json",
    ):
        source = read_evidence(project_root, relative)
        installed = read_evidence(installed_root, relative)
        if source != installed:
            raise ValueError("Source and installation input differ")
        inputs[relative] = sha256(source)
        locks[relative] = source
    sources = []
    for category, relative in (
        ("project_license_not_third_party_default", "LICENSE"),
        (
            "google_brand_source_record_not_provider_approval",
            "bodyguard/frontend/public/brand/README.md",
        ),
        (
            "google_brand_image_not_open_source_license",
            "bodyguard/frontend/public/brand/google-icon.png",
        ),
        (
            "blender_mpfb_historical_source_record_not_final_asset_clearance",
            "bodyguard/assets/blender/README.md",
        ),
        (
            "avatar_historical_production_record_not_final_acceptance",
            "bodyguard/docs/avatar-production.md",
        ),
    ):
        sources.append(
            {
                "category": category,
                "path": relative,
                "sha256": sha256(read_evidence(project_root, relative)),
                "distribution_approved": False,
            }
        )
    return {
        "schema_version": 1,
        "scope": "license_provenance_evidence_only",
        "distribution_approved": False,
        "source_inputs": inputs,
        "npm": npm_inventory(
            installed_root / "bodyguard/frontend",
            locks["bodyguard/frontend/pnpm-lock.yaml"],
            npm_queries,
        ),
        "python": python_inventory(
            installed_root / "bodyguard/backend", locks["bodyguard/backend/uv.lock"]
        ),
        "sources": sources,
        "remaining_gates": [
            "complete_notice_copyright_and_nested_component_review",
            "final_bundle_container_and_model_inventory",
            "delivered_notices_and_license_obligations",
            "google_brand_and_provider_review",
            "final_avatar_source_and_reference_rights",
            "business_legal_decisions_and_release_approval",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read bounded evidence; never grant release approval"
    )
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--installed-root", type=Path, required=True)
    parser.add_argument("--input-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        queries = {
            "runtime_candidate": read_evidence(args.input_dir, "pnpm-runtime.json"),
            "dev_tool_candidate": read_evidence(args.input_dir, "pnpm-dev.json"),
        }
        report = collect_inventory(args.project_root, args.installed_root, queries)
        print(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2))
        return 0
    except (ValueError, KeyError, TypeError, OSError) as error:
        # No exception values, package strings, URLs or filesystem/user identities in logs.
        print(
            f"Inventory extraction failed ({type(error).__name__}); no approval granted",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
