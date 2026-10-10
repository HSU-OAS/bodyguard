"""FR-U-05/NFR-08: reject unsafe oracle inputs, enforce native SQL read-only."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from tests.withdrawal_data_probe import counts, identities, read_connection, target


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "sqlite:///bodyguard_test",
        "postgresql+psycopg://bodyguard_test@localhost/bodyguard_test",
        "postgresql+psycopg://bodyguard_test@127.0.0.1/bodyguard_test",
        "postgresql+psycopg://bodyguard_test@/bodyguard?host=/private/tmp/bodyguard-auth-test.x/socket",
        "postgresql+psycopg://other@/bodyguard_test?host=/private/tmp/bodyguard-auth-test.x/socket",
        "postgresql+psycopg://bodyguard_test@/bodyguard_test?host=/private/tmp/other/socket",
        "postgresql+psycopg://bodyguard_test@/bodyguard_test?host=/private/tmp/bodyguard-auth-test.x/socket&options=x",
        "postgresql+psycopg://bodyguard_test:password@/bodyguard_test?host=/private/tmp/bodyguard-auth-test.x/socket",
    ],
)
def test_reject_target_before_connection(raw, monkeypatch):
    def forbidden_connection(*args, **kwargs):
        pytest.fail("Unsafe target reached connection construction")

    monkeypatch.setattr("tests.withdrawal_data_probe.create_engine", forbidden_connection)
    with pytest.raises(ValueError, match="Refusing unowned test database"):
        target(raw)
    with pytest.raises(ValueError, match="Refusing unowned test database"), read_connection(raw):
        pytest.fail("Unsafe target yielded a connection")


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        {},
        {"untrusted_table": "x"},
        {"owner": None},
        {"owner": "x' OR 1=1"},
        {"owner": str(uuid4()).upper()},
    ],
)
def test_reject_identity_input(value):
    with pytest.raises(ValueError):
        identities(value)


def test_reject_duplicate_identities():
    value = str(uuid4())
    with pytest.raises(ValueError, match="must differ"):
        identities({"owner": value, "other": value})


def test_private_sql_counts_and_server_readonly(harness):
    h = harness
    owner = h.account()
    raw = h.engine.url.render_as_string(hide_password=False)
    result = counts(raw, {"owner": owner})
    assert result == {
        "owner": {
            "users": 1,
            "sessions": 1,
            "stretch_records": 0,
            "baselines": 0,
            "minute_summaries": 0,
            "notification_preferences": 0,
        }
    }
    # PostgreSQL itself must deny a write; no table is created, no policy bypass.
    with pytest.raises(DBAPIError) as error, read_connection(raw) as connection:
        connection.execute(text("CREATE TABLE bodyguard_forbidden_oracle_write (id integer)"))
    assert error.value.orig.sqlstate == "25006"
    with h.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT to_regclass('bodyguard_forbidden_oracle_write')"))
            is None
        )
