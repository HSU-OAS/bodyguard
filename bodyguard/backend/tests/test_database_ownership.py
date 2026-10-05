"""FR-U-05/NFR-08: competing harnesses must fail before migration or fixture reset."""

import pytest

from tests.conftest import Harness
from tests.conftest import test_database as isolated_database
from tests.test_records import payload


def test_competing_database_harness_keeps_owner_records(harness: Harness) -> None:
    h = harness
    h.account()
    item = payload(h)
    assert h.client.post("/api/v1/records/stretch", headers=h.csrf(), json=item).status_code == 201
    with pytest.raises(pytest.fail.Exception, match="busy; refuse migration/reset"):
        with isolated_database():
            pytest.fail("Competing harness entered the protected database")
    assert [row["id"] for row in h.client.get("/api/v1/records/stretch").json()["items"]] == [
        item["id"]
    ]
