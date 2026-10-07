"""FR-R-01/04, FR-U-03: real SQL locks, synthetic aggregate/clock, no camera inference."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from time import monotonic

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, event, select, text

from app.db import minute_summaries, sessions
from app.readiness import EXPECTED_REVISION
from app.security import digest
from tests.test_account_withdrawal import begin, confirm
from tests.test_password_reset import NEW_PASSWORD, request_link
from tests.test_summaries import PATH, payload, post, preview, remove
from tests.test_withdrawal_races import other_session


@pytest.mark.parametrize("kind", ["new", "same", "conflict"])
def test_two_real_sessions_serialize(harness, kind):
    h = harness
    h.account()
    first = payload()
    second = payload(59) if kind == "new" else payload()
    if kind == "conflict":
        second["client_version"] = "Different"
    with other_session(h) as client:
        clients = [h.client, client]
        proofs = [h.csrf(c) for c in clients]
        barrier = Barrier(2)

        def run(index):
            barrier.wait(timeout=3)
            return (
                clients[index]
                .post(
                    PATH + "/batch", headers=proofs[index], json={"items": [[first, second][index]]}
                )
                .status_code
            )

        with ThreadPoolExecutor(2) as pool:
            statuses = list(pool.map(run, range(2)))
        assert (
            sorted(statuses)
            == {"new": [201, 201], "same": [200, 201], "conflict": [201, 409]}[kind]
        )
    with h.engine.connect() as c:
        assert len(c.execute(select(minute_summaries)).all()) == (2 if kind == "new" else 1)


@pytest.mark.parametrize("expiry", ["idle", "absolute"])
def test_owner_wait_rechecks_expiry_without_renewal(harness, expiry):
    h = harness
    owner = h.account()
    proof = h.csrf()
    cookie = digest(h.client.cookies.get(h.settings.cookie_name))
    entered = Event()
    with h.engine.connect() as c:
        last_seen = c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))

    def before(*args):
        if str(args[2]).startswith("SELECT pg_advisory_xact_lock"):
            entered.set()

    event.listen(h.engine, "before_cursor_execute", before)
    try:
        with h.engine.connect() as blocker:
            tx = blocker.begin()
            blocker.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.summary-owner." + owner},
            )
            entered.clear()
            with ThreadPoolExecutor(1) as pool:
                waiting = pool.submit(
                    h.client.post, PATH + "/batch", headers=proof, json={"items": [payload()]}
                )
                try:
                    assert entered.wait(3)
                    h.clock.now += timedelta(minutes=31) if expiry == "idle" else timedelta(hours=8)
                finally:
                    tx.rollback()
                assert waiting.result(timeout=5).status_code == 403
        with h.engine.connect() as c:
            assert c.execute(select(minute_summaries)).first() is None
            assert (
                c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))
                == last_seen
            )
    finally:
        event.remove(h.engine, "before_cursor_execute", before)


def test_reset_during_user_pin_wait_rejects_old_writer(harness):
    h = harness
    h.account()
    link, proof = request_link(h), h.csrf()
    locked, waiting, release = Event(), Event(), Event()

    def after(*args):
        if str(args[2]).startswith("SELECT users.id") and str(args[2]).endswith("FOR UPDATE"):
            locked.set()
            assert release.wait(5)

    def before(*args):
        if str(args[2]).endswith("FOR KEY SHARE"):
            waiting.set()

    with h.new_client() as reset_client:
        reset_proof = h.csrf(reset_client)
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
                    assert locked.wait(3)
                    writing = pool.submit(
                        h.client.post, PATH + "/batch", headers=proof, json={"items": [payload()]}
                    )
                    assert waiting.wait(3)
                finally:
                    release.set()
                assert resetting.result(timeout=5).status_code == 204
                assert writing.result(timeout=5).status_code == 403
        finally:
            event.remove(h.engine, "after_cursor_execute", after)
            event.remove(h.engine, "before_cursor_execute", before)
    assert h.client.get(PATH).status_code == 401
    assert h.login(password=NEW_PASSWORD).status_code == 200
    assert h.client.get(PATH).json()["items"] == []


def test_withdrawal_conflict_preserves_then_retry_cascades(harness):
    h = harness
    h.account()
    challenge, code = begin(h)
    entered, release = Event(), Event()

    def after(*args):
        if str(args[2]).startswith("INSERT INTO minute_summaries"):
            entered.set()
            assert release.wait(5)

    with other_session(h) as second:
        proof = h.csrf(second)
        event.listen(h.engine, "after_cursor_execute", after)
        try:
            with ThreadPoolExecutor(1) as pool:
                writing = pool.submit(
                    second.post, PATH + "/batch", headers=proof, json={"items": [payload()]}
                )
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
        assert c.execute(select(minute_summaries)).first() is None


def test_real_lock_timeout_rolls_back_session_activity(harness):
    h = harness
    owner = h.account()
    proof = h.csrf()
    cookie = digest(h.client.cookies.get(h.settings.cookie_name))
    with h.engine.connect() as c:
        last_seen = c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))
    h.clock.now += timedelta(minutes=1)
    with h.engine.connect() as blocker:
        tx = blocker.begin()
        try:
            blocker.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": "bodyguard.summary-owner." + owner},
            )
            start = monotonic()
            response = h.client.post(PATH + "/batch", headers=proof, json={"items": [payload()]})
            assert 1.7 < monotonic() - start < 5
            assert response.status_code == 503
        finally:
            tx.rollback()
    with h.engine.connect() as c:
        assert (
            c.scalar(select(sessions.c.last_seen_at).where(sessions.c.token_hash == cookie))
            == last_seen
        )
        assert c.execute(select(minute_summaries)).first() is None
    assert post(h, payload()).status_code == 201


def test_downgrade_waits_for_insert_and_preserves_committed_data(harness):
    h = harness
    h.account()
    proof = h.csrf()
    inserted, dropping, release = Event(), Event(), Event()

    def after(*args):
        if str(args[2]).startswith("INSERT INTO minute_summaries"):
            inserted.set()
            assert release.wait(5)

    def before(*args):
        if str(args[2]).startswith("LOCK TABLE minute_summaries IN ACCESS EXCLUSIVE"):
            dropping.set()

    event.listen(h.engine, "after_cursor_execute", after)
    event.listen(Engine, "before_cursor_execute", before)
    try:
        with ThreadPoolExecutor(2) as pool:
            writing = pool.submit(
                h.client.post, PATH + "/batch", headers=proof, json={"items": [payload()]}
            )
            try:
                assert inserted.wait(3)
                migration = pool.submit(
                    command.downgrade, Config("alembic.ini"), "0007_account_baselines"
                )
                assert dropping.wait(3)
            finally:
                release.set()
            assert writing.result(timeout=5).status_code == 201
            with pytest.raises(RuntimeError, match="backup"):
                migration.result(timeout=5)
    finally:
        event.remove(h.engine, "after_cursor_execute", after)
        event.remove(Engine, "before_cursor_execute", before)
    with h.engine.connect() as c:
        assert c.scalar(text("SELECT version_num FROM alembic_version")) == EXPECTED_REVISION
        assert len(c.execute(select(minute_summaries)).all()) == 1


def test_preview_then_other_session_delete_does_not_delete_new_row(harness):
    h = harness
    h.account()
    assert post(h, payload()).status_code == 201
    original_proof = preview(h)
    assert remove(h, original_proof).json() == {"deleted": 1}
    h.clock.now += timedelta(seconds=1)
    assert post(h, payload()).status_code == 201
    assert remove(h, original_proof).json() == {"deleted": 0}
    assert len(h.client.get(PATH).json()["items"]) == 1
