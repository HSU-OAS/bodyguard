"""NFR-08/FR-U-05: native isolated archive proof, not operational backup approval."""

import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from tests.backup_restore_proof import _OwnedCluster, _schemas_equivalent, run_isolated_proof


def test_native_owned_backup_restore_and_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    # The implementation must start two new owned clusters; never borrow engine/URL fixtures.
    monkeypatch.setenv("PGHOST", "not-a-proof-database.invalid")
    monkeypatch.setenv("PGDATABASE", "refuse_external_database")
    monkeypatch.setenv("BODYGUARD_DATABASE_URL", "refuse_external_database")
    result = run_isolated_proof()
    assert result["revision"] == "0008_minute_summaries"
    assert result["source_counts"] == {"users": 2, "stretch_records": 3}
    assert result["restored_counts"] == result["source_counts"]
    assert result["record_contents_match"] is True
    assert result["notification_preferences_restored"] is True
    assert result["baseline_history_and_owner_restored"] is True
    assert result["minute_summaries_restored"] is True
    assert result["minute_summary_owner_isolation_restored"] is True
    assert result["minute_summary_constraints_restored"] is True
    assert result["database_constraints_preserved"] is True
    assert result["ready_status"] == 200
    assert result["login_status"] == 200
    assert result["other_owner_status"] == 404
    assert result["corrupt_archive_rejected"] is True
    assert result["restore_did_not_mutate_source"] is True
    # Expected risk observation is NOT a production safety pass.
    assert result["post_snapshot_deletion_replay_observed"] is True
    assert result["post_snapshot_revocation_replay_observed"] is True
    assert result["post_snapshot_credentials_replay_observed"] is True
    assert result["operational_restore_approved"] is False
    assert result["proof_completed"] is True
    assert result["owned_servers_stopped"] is True


def test_native_failure_stops_both_new_owned_servers(monkeypatch: pytest.MonkeyPatch) -> None:
    # Inject an execution interruption, NOT a simulated pg_dump/restore success/failure.
    roots: list[Path] = []
    allocate = tempfile.mkdtemp

    def record_allocation(*args: object, **kwargs: object) -> str:
        path = allocate(*args, **kwargs)
        roots.append(Path(path))
        return path

    monkeypatch.setattr(tempfile, "mkdtemp", record_allocation)
    with pytest.raises(RuntimeError, match="Intentional test-only interruption"):
        run_isolated_proof(_interrupt_before_restore=True)
    assert len(roots) == 1
    report = json.loads((roots[0] / "aggregate-report.json").read_text())
    assert report["owned_servers_stopped"] is True
    assert report["proof_completed"] is False
    assert report["operational_restore_approved"] is False
    for name in ("source", "target"):
        assert not (roots[0] / name / "data" / "postmaster.pid").exists()
        assert (roots[0] / name / "server.log").exists()
    # No backup or restore took place after this deliberately aborted start.
    assert "restored_counts" not in report


def test_directory_replacement_is_rejected_before_native_command() -> None:
    root = Path(tempfile.mkdtemp(prefix="bodyguard-backup-proof.", dir="/private/tmp"))
    native = shutil.which("pg_ctl")
    assert native is not None
    cluster = _OwnedCluster(root, "guard-only", Path(native).resolve().parent)
    cluster.socket.rename(cluster.directory / "preserved-original-socket")
    cluster.socket.mkdir(mode=0o700)
    with pytest.raises(RuntimeError, match="Owned cluster directory changed"):
        cluster.command("pg_ctl", "--version")
    assert not (cluster.directory / "commands.log").exists()
    assert not cluster.data.exists()  # A path test, not a started-server cleanup proof.


def test_schema_comparison_does_not_ignore_changed_rules() -> None:
    source = [["constraint", "stretch_records", "record_outcome", "CHECK (outcome = 'unknown')"]]
    assert _schemas_equivalent(source, source)
    assert not _schemas_equivalent(source, [])
    assert not _schemas_equivalent(source, [source[0][:3] + ["CHECK (true)"]])
    assert not _schemas_equivalent(
        [["column", "users", "email", "character varying:NO:"]],
        [["column", "users", "email", "character varying:YES:"]],
    )


def test_stop_refuses_a_real_non_postgres_pid() -> None:
    # Only a synthetic PID file in a fresh test directory; no actual PID file is edited.
    root = Path(tempfile.mkdtemp(prefix="bodyguard-backup-proof.", dir="/private/tmp"))
    native = shutil.which("pg_ctl")
    assert native is not None
    cluster = _OwnedCluster(root, "pid-guard-only", Path(native).resolve().parent)
    cluster.data.mkdir(mode=0o700)
    cluster.pid = os.getpid()
    cluster.started = True
    (cluster.data / "postmaster.pid").write_text(f"{cluster.pid}\n{cluster.data}\n")
    with pytest.raises(RuntimeError, match="PID command ownership changed"):
        cluster.stop()
    assert not (cluster.directory / "commands.log").exists()  # No native stop or signal.
