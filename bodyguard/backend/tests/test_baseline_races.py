"""B03–06: real PostgreSQL lock schedules; synthetic account/time, no camera inference."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from time import monotonic

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, event, select, text

from app.db import baselines, sessions
from app.security import digest
from tests.conftest import Harness
from tests.test_account_withdrawal import begin, confirm
from tests.test_baselines import PATH, payload, save
from tests.test_password_reset import NEW_PASSWORD, request_link
from tests.test_withdrawal_races import other_session


@pytest.mark.parametrize("kind", ["new", "same", "conflict"])
def test_b03_two_real_sessions_serialize_without_losing_history(
    harness: Harness, kind: str
) -> None:
    h = harness
    h.account()
    first = payload()
    second_body = payload() if kind == "new" else dict(first)
    if kind == "conflict":
        second_body["client_version"] = "Different"
    with other_session(h) as second:
        clients = [h.client, second]
        proofs = [h.csrf(c) for c in clients]
        barrier = Barrier(2)

        def post(index: int) -> int:
            barrier.wait(timeout=3)
            return (
                clients[index]
                .post(PATH, headers=proofs[index], json=[first, second_body][index])
                .status_code
            )

        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(post, range(2)))
        assert (
            sorted(results) == {"new": [201, 201], "same": [200, 201], "conflict": [201, 409]}[kind]
        )
    with h.engine.connect() as c:
        rows = c.execute(select(baselines)).mappings().all()
        assert len(rows) == (2 if kind == "new" else 1)
        assert sum(row["is_active"] for row in rows) == 1


@pytest.mark.parametrize("expiry", ["idle", "absolute"])
def test_b04_wait_does_not_renew_expired_session(harness: Harness, expiry: str) -> None:
    h = harness
    owner = h.account()
    save(h, payload())
    proof = h.csrf()
    entered = Event()

    def before(*args: object) -> None:
        if str(args[2]).startswith("SELECT pg_advisory_xact_lock"):
            entered.set()

    event.listen(h.engine, "before_cursor_execute", before)
    try:
        with h.engine.connect() as blocker:
            transaction = blocker.begin()
            blocker.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.baseline-owner." + owner},
            )
            entered.clear()
            with ThreadPoolExecutor(1) as pool:
                pending = pool.submit(h.client.post, PATH, headers=proof, json=payload())
                try:
                    assert entered.wait(3)
                    h.clock.now += timedelta(minutes=31) if expiry == "idle" else timedelta(hours=8)
                finally:
                    transaction.rollback()
                assert pending.result(timeout=5).status_code == 403
        with h.engine.connect() as c:
            rows = c.execute(select(baselines.c.is_active)).scalars().all()
            assert rows == [True]
    finally:
        event.remove(h.engine, "before_cursor_execute", before)


def test_b05_reset_commit_during_user_pin_wait_rejects_stale_writer(harness: Harness) -> None:
    h = harness
    h.account()
    first = save(h, payload())
    link = request_link(h)
    proof = h.csrf()
    reset_locked, writer_waiting, release = Event(), Event(), Event()

    def after(*args: object) -> None:
        sql = str(args[2])
        if sql.startswith("SELECT users.id") and sql.endswith("FOR UPDATE"):
            reset_locked.set()
            assert release.wait(5)

    def before(*args: object) -> None:
        if str(args[2]).endswith("FOR KEY SHARE"):
            writer_waiting.set()

    with h.new_client() as reset_client:
        reset_proof = h.csrf(reset_client)  # Independent anonymous reset, no opposing session lock.
        event.listen(h.engine, "after_cursor_execute", after)
        event.listen(h.engine, "before_cursor_execute", before)
        try:
            with ThreadPoolExecutor(2) as pool:
                resetting = pool.submit(
                    reset_client.post,
                    "/api/v1/auth/password/reset",
                    headers=reset_proof,
                    json={"token": link, "password": NEW_PASSWORD},
                )
                try:
                    assert reset_locked.wait(3)
                    writing = pool.submit(h.client.post, PATH, headers=proof, json=payload())
                    assert writer_waiting.wait(3)
                finally:
                    release.set()
                assert resetting.result(timeout=5).status_code == 204
                assert writing.result(timeout=5).status_code == 403
        finally:
            event.remove(h.engine, "after_cursor_execute", after)
            event.remove(h.engine, "before_cursor_execute", before)
    assert h.client.get(PATH + "/active").status_code == 401
    assert h.login(password=NEW_PASSWORD).status_code == 200
    assert h.client.get(PATH + "/active").json() == first


def test_b05_withdrawal_conflict_then_retry_after_baseline_commit(harness: Harness) -> None:
    h = harness
    h.account()
    challenge, code = begin(h)
    entered, release = Event(), Event()

    def after(*args: object) -> None:
        if str(args[2]).startswith("INSERT INTO baselines"):
            entered.set()
            assert release.wait(5)

    with other_session(h) as second:
        proof = h.csrf(second)
        event.listen(h.engine, "after_cursor_execute", after)
        try:
            with ThreadPoolExecutor(1) as pool:
                writing = pool.submit(second.post, PATH, headers=proof, json=payload())
                try:
                    assert entered.wait(3)
                    assert confirm(h, challenge, code).status_code == 503
                finally:
                    release.set()
                assert writing.result(timeout=5).status_code == 201
        finally:
            event.remove(h.engine, "after_cursor_execute", after)
    assert confirm(h, challenge, code).status_code == 204
    with h.engine.connect() as c:
        assert c.execute(select(baselines)).first() is None


def test_b06_downgrade_waits_for_concurrent_insert_then_preserves_it(harness: Harness) -> None:
    h = harness
    h.account()
    proof = h.csrf()
    inserted, dropping, release = Event(), Event(), Event()

    def after(*args: object) -> None:
        if str(args[2]).startswith("INSERT INTO baselines"):
            inserted.set()
            assert release.wait(5)

    def before(*args: object) -> None:
        if str(args[2]).startswith("LOCK TABLE baselines IN ACCESS EXCLUSIVE"):
            dropping.set()

    # Alembic creates its own engine against the same ownership-guarded test DB.
    # Engine event observes the actual migration SQL; neither op nor SQL is mocked.
    config = Config("alembic.ini")

    def downgrade() -> None:
        command.downgrade(config, "0006_notification_preferences")

    event.listen(h.engine, "after_cursor_execute", after)
    event.listen(Engine, "before_cursor_execute", before)
    try:
        with ThreadPoolExecutor(2) as pool:
            writing = pool.submit(h.client.post, PATH, headers=proof, json=payload())
            try:
                assert inserted.wait(3)
                migration = pool.submit(downgrade)
                assert dropping.wait(3)
            finally:
                release.set()
            assert writing.result(timeout=5).status_code == 201
            with pytest.raises(RuntimeError, match="backup"):
                migration.result(timeout=5)
    finally:
        event.remove(h.engine, "after_cursor_execute", after)
        event.remove(Engine, "before_cursor_execute", before)
    assert h.client.get(PATH + "/active").status_code == 200
    with h.engine.connect() as c:
        assert c.scalar(text("SELECT version_num FROM alembic_version")) == "0007_account_baselines"


def test_b05_actual_owner_lock_timeout_preserves_active(harness: Harness) -> None:
    h = harness
    owner = h.account()
    original = save(h, payload())
    proof = h.csrf()
    cookie = digest(h.client.cookies.get(h.settings.cookie_name))
    with h.engine.connect() as c:
        before = c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))
    h.clock.now += timedelta(minutes=1)
    with h.engine.connect() as blocker:
        transaction = blocker.begin()
        try:
            blocker.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.baseline-owner." + owner},
            )
            started = monotonic()
            response = h.client.post(PATH, headers=proof, json=payload())
            assert 1.7 < monotonic() - started < 5
            assert response.status_code == 503
            assert response.json() == {"detail": "서비스 연결을 다시 시도해 주세요."}
        finally:
            transaction.rollback()
    with h.engine.connect() as c:
        assert (
            c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))
            == before
        )
        assert len(c.execute(select(baselines)).all()) == 1
    assert h.client.get(PATH + "/active").json() == original
    save(h, payload())  # Explicit fresh retry after release succeeds; no lock leak.
