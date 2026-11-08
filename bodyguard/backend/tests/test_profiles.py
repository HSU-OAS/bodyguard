"""FR-U-04/05: synthetic account profiles on an isolated PostgreSQL database."""

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select

from app.db import user_profiles
from tests.conftest import Harness
from tests.test_account_withdrawal import begin, confirm

PATH = "/api/v1/profile"


def headers(h: Harness, account: str, client=None):
    return {**h.csrf(client), "X-Account-ID": account}


def test_optional_profile_edit_clear_and_stale_revision(harness: Harness) -> None:
    h = harness
    assert h.client.get(PATH).status_code == 401
    account = h.account()
    assert h.client.get(PATH).status_code == 403
    own = headers(h, account)
    assert h.client.get(PATH, headers=own).json() == {
        "nickname": None,
        "age": None,
        "height_cm": None,
        "weight_kg": None,
        "gender": None,
        "revision": 0,
    }
    first = h.client.post(
        PATH,
        headers=own,
        json={
            "revision": 0,
            "nickname": " 가상 사용자 ",
            "age": 28,
            "height_cm": 170.5,
            "weight_kg": 65.2,
            "gender": "female",
        },
    )
    assert first.status_code == 200
    assert first.json()["nickname"] == "가상 사용자"
    assert first.json()["revision"] == 1
    assert h.client.post(PATH, headers=own, json={"revision": 0}).status_code == 409
    cleared = h.client.post(PATH, headers=own, json={"revision": 1})
    assert cleared.status_code == 200
    assert cleared.json() == {
        "nickname": None,
        "age": None,
        "height_cm": None,
        "weight_kg": None,
        "gender": None,
        "revision": 2,
    }
    assert h.client.post(PATH, headers=own, json={"revision": 1, "age": 99}).status_code == 409
    with h.engine.connect() as connection:
        row = (
            connection.execute(select(user_profiles).where(user_profiles.c.user_id == account))
            .mappings()
            .one()
        )
        assert all(
            row[field] is None for field in ("nickname", "age", "height_cm", "weight_kg", "gender")
        )


@pytest.mark.parametrize(
    "change",
    [
        {"nickname": " "},
        {"nickname": "가" * 61},
        {"nickname": "bad\x00name"},
        {"age": True},
        {"age": 151},
        {"height_cm": 0},
        {"weight_kg": -1},
        {"gender": "other"},
        {"user_id": "another"},
        {"revision": -1},
    ],
)
def test_invalid_profile_is_not_saved(harness: Harness, change: dict) -> None:
    h = harness
    account = h.account()
    own = headers(h, account)
    assert h.client.post(PATH, headers=own, json={"revision": 0, **change}).status_code == 422
    assert h.client.get(PATH, headers=own).json()["revision"] == 0


def test_profile_is_bound_to_session_account_and_csrf(harness: Harness) -> None:
    h = harness
    owner = h.account()
    own = headers(h, owner)
    assert (
        h.client.post(PATH, headers=own, json={"revision": 0, "nickname": "first"}).status_code
        == 200
    )
    other = h.new_client()
    challenge = other.post(
        "/api/v1/auth/signup",
        headers=h.csrf(other),
        json={"email": "second@example.com", "password": "second fixture password 1234"},
    ).json()["challenge_id"]
    other_id = other.post(
        "/api/v1/auth/verify",
        headers=h.csrf(other),
        json={"challenge_id": challenge, "code": h.mail.messages[-1][1]},
    ).json()["id"]
    other_headers = headers(h, other_id, other)
    assert other.get(PATH, headers=own).status_code == 403
    assert other.get(PATH, headers=other_headers).json()["nickname"] is None
    assert other.post(PATH, headers=own, json={"revision": 1, "nickname": "bad"}).status_code == 403
    assert (
        other.post(
            PATH, headers=other_headers, json={"revision": 0, "nickname": "second"}
        ).status_code
        == 200
    )
    assert h.client.get(PATH, headers=own).json()["nickname"] == "first"
    assert h.client.post(PATH, json={"revision": 1}).status_code == 403
    other.close()


def test_account_withdrawal_deletes_profile_and_downgrade_refuses_data(harness: Harness) -> None:
    h = harness
    account = h.account()
    own = headers(h, account)
    assert h.client.post(PATH, headers=own, json={"revision": 0, "age": 28}).status_code == 200
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(Config("alembic.ini"), "0008_minute_summaries")
    assert h.client.get(PATH, headers=own).json()["age"] == 28
    challenge, code = begin(h)
    assert confirm(h, challenge, code).status_code == 204
    with h.engine.connect() as connection:
        assert (
            connection.execute(
                select(user_profiles.c.user_id).where(user_profiles.c.user_id == account)
            ).first()
            is None
        )


def test_downgrade_waits_for_concurrent_profile_and_preserves_it(harness: Harness) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from sqlalchemy import event, text
    from sqlalchemy.engine import Engine

    h = harness
    account = h.account()
    own = headers(h, account)
    inserted, locking, release = Event(), Event(), Event()

    def after(*args):
        if str(args[2]).startswith("INSERT INTO user_profiles"):
            inserted.set()
            assert release.wait(5)

    def before(*args):
        if str(args[2]).startswith("LOCK TABLE user_profiles IN ACCESS EXCLUSIVE"):
            locking.set()

    event.listen(h.engine, "after_cursor_execute", after)
    event.listen(Engine, "before_cursor_execute", before)
    try:
        with ThreadPoolExecutor(2) as pool:
            writing = pool.submit(h.client.post, PATH, headers=own, json={"revision": 0, "age": 28})
            try:
                assert inserted.wait(3)
                migration = pool.submit(
                    command.downgrade, Config("alembic.ini"), "0008_minute_summaries"
                )
                assert locking.wait(3)
            finally:
                release.set()
            assert writing.result(timeout=5).status_code == 200
            with pytest.raises(RuntimeError, match="backup"):
                migration.result(timeout=5)
    finally:
        event.remove(h.engine, "after_cursor_execute", after)
        event.remove(Engine, "before_cursor_execute", before)
    with h.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0009_optional_profile"
        )
    assert h.client.get(PATH, headers=own).json()["age"] == 28
