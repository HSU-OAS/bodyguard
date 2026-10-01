"""FR-U-01/NFR-08: actual API/PG/SDK crypto; Google HTTPS is a synthetic fixture."""

import base64
import hashlib
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx2
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import OctKey, RSAKey
from pydantic import SecretStr, ValidationError
from sqlalchemy import insert, select, text
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.db import google_flows, resets, sessions, users
from app.main import create_app
from app.security import digest, keyed
from tests.conftest import ORIGIN, Harness
from tests.test_auth import count, snapshot

LOGIN = "/api/v1/auth/google/login"
CALLBACK = "/api/v1/auth/google/callback"
CLIENT_ID = "synthetic-client.apps.googleusercontent.com"


class Provider:
    """Transport-only fake HTTPS; actual SDK signature/claims path is unchanged."""

    def __init__(self, h: Harness, rsa: RSAKey) -> None:
        self.h, self.rsa = h, rsa
        self.codes: dict[str, tuple[str, str, str]] = {}
        self.requests: list[tuple[str, str]] = []
        self.fault = ""
        self.entered: Barrier | None = None
        self.action = lambda: None

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append((request.method, str(request.url)))
        assert request.url.scheme == "https"
        if request.url == "https://www.googleapis.com/oauth2/v3/certs":
            if self.fault == "bad-jwks":
                return httpx2.Response(200, json={"keys": []})
            return httpx2.Response(200, json={"keys": [self.rsa.as_dict(private=False)]})
        assert request.url == "https://oauth2.googleapis.com/token"
        if self.fault == "outage":
            return httpx2.Response(503, json={"error": "RAW-PROVIDER-SECRET"})
        values = parse_qs(request.content.decode())
        assert values["client_id"] == [CLIENT_ID]
        assert values["client_secret"] == ["synthetic-client-secret-never-real"]
        assert values["redirect_uri"] == [ORIGIN + CALLBACK]
        assert values["grant_type"] == ["authorization_code"]
        challenge, nonce, sub = self.codes.pop(values["code"][0])
        verifier = values["code_verifier"][0]
        actual = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        assert actual == challenge
        if self.entered:
            self.entered.wait(timeout=5)
        self.action()
        now = int(time.time())
        claims: dict[str, object] = {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "sub": sub,
            "exp": now + 3600,
            "iat": now,
            "nonce": nonce,
            "email": "google.person@example.com",
            "email_verified": True,
        }
        faults: dict[str, tuple[str, object]] = {
            "issuer": ("iss", "https://attacker.invalid"),
            "bare-issuer": ("iss", "accounts.google.com"),
            "audience": ("aud", "another-client"),
            "audience-with-azp": ("aud", "another-client"),
            "azp": ("azp", "another-client"),
            "nonce": ("nonce", "different-nonce"),
            "nonce-bypass": ("nonce", "different-nonce"),
            "expired": ("exp", now - 1),
            "equal-expiry": ("exp", now),
            "future-iat": ("iat", now + 3600),
            "boolean-iat": ("iat", True),
            "unverified": ("email_verified", False),
            "string-verified": ("email_verified", "true"),
            "invalid-email": ("email", "not-an-email"),
            "changed-email": ("email", "google.changed@example.com"),
            "blank-sub": ("sub", ""),
            "unicode-sub": ("sub", "잘못된 식별자"),
            "long-sub": ("sub", "x" * 256),
            "access-hash": ("at_hash", "wrong-access-token-hash"),
        }
        if self.fault in faults:
            key, value = faults[self.fault]
            claims[key] = value
        if self.fault == "nonce-bypass":
            claims["nonce_supported"] = False
        if self.fault == "audience-with-azp":
            claims["azp"] = CLIENT_ID
        if self.fault.startswith("missing-"):
            claims.pop(self.fault.removeprefix("missing-"), None)
        header = {"alg": "RS256", "kid": self.rsa.as_dict(private=False)["kid"]}
        if self.fault == "wrong-kid":
            header["kid"] = "unknown-key"
        signing = RSAKey.generate_key(2048) if self.fault == "signature" else self.rsa
        encoded = jwt.encode(header, claims, signing)
        if self.fault == "hmac-algorithm":
            encoded = jwt.encode(
                {"alg": "HS256", "kid": "fixture"},
                claims,
                OctKey.import_key(b"synthetic-attacker-secret-32bytes!"),
            )
        if self.fault == "unsigned":

            def part(data: str) -> str:
                return base64.urlsafe_b64encode(data.encode()).decode().rstrip("=")

            encoded = part('{"alg":"none"}') + "." + part('{"sub":"attacker"}') + "."
        data = {
            "access_token": "synthetic-access-secret",
            "token_type": "Bearer",
            "id_token": encoded,
        }
        if self.fault == "no-id-token":
            del data["id_token"]
        return httpx2.Response(200, json=data)


@pytest.fixture(scope="module")
def rsa() -> RSAKey:
    return RSAKey.generate_key(2048, parameters={"kid": "fixture"})


@pytest.fixture
def google(harness: Harness, rsa: RSAKey) -> tuple[Harness, Provider, TestClient]:
    h = harness
    h.settings = h.settings.model_copy(
        update={
            "google_client_id": CLIENT_ID,
            "google_client_secret": SecretStr("synthetic-client-secret-never-real"),
        }
    )
    provider = Provider(h, rsa)
    client = TestClient(
        create_app(
            h.settings,
            h.engine,
            h.mail,
            h.clock,
            reset_mail=h.mail,
            google_transport=httpx2.MockTransport(provider.handle),
        ),
        base_url="http://localhost",
        client=("testclient", 50000),
    )
    yield h, provider, client
    client.close()


def begin(
    client: TestClient, provider: Provider, sub: str = "synthetic-google-sub"
) -> tuple[str, str]:
    result = client.get(LOGIN, follow_redirects=False)
    assert result.status_code == 303, result.text
    location = urlsplit(result.headers["location"])
    assert location.scheme == "https" and location.netloc == "accounts.google.com"
    values = parse_qs(location.query)
    assert values["scope"] == ["openid email"]
    assert values["response_type"] == ["code"]
    assert values["code_challenge_method"] == ["S256"]
    assert values["redirect_uri"] == [ORIGIN + CALLBACK]
    assert "access_type" not in values
    authorization_code = secrets.token_urlsafe(32)
    provider.codes[authorization_code] = (values["code_challenge"][0], values["nonce"][0], sub)
    return values["state"][0], authorization_code


def callback(client: TestClient, state: str, code: str) -> httpx2.Response:
    return client.get(CALLBACK, params={"state": state, "code": code}, follow_redirects=False)


def assert_failed(response: object, kind: str = "failed") -> None:
    assert response.status_code == 303
    assert response.headers["location"] == ORIGIN + "/login?google=" + kind
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_g02_new_google_account_and_repeated_sub(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    cookie = client.cookies.get(h.settings.cookie_name)
    with h.engine.connect() as c:
        flow = c.execute(select(google_flows)).mappings().one()
        assert flow["state_hash"] == digest(state) and flow["session_hash"] == digest(cookie)
        assert state not in repr(flow)
    result = callback(client, state, code)
    assert result.status_code == 303 and result.headers["location"] == ORIGIN + "/start"
    assert client.cookies.get(h.settings.cookie_name) != cookie
    user_id = client.get("/api/v1/me").json()["id"]
    assert client.post("/api/v1/auth/logout", headers=h.csrf(client)).status_code == 204
    state, code = begin(client, provider)
    provider.fault = "bare-issuer"
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    assert client.get("/api/v1/me").json()["id"] == user_id
    assert count(h, users) == 1 and not h.mail.messages


@pytest.mark.parametrize(
    "fault",
    [
        "signature",
        "wrong-kid",
        "unsigned",
        "hmac-algorithm",
        "issuer",
        "audience",
        "audience-with-azp",
        "azp",
        "nonce",
        "nonce-bypass",
        "expired",
        "equal-expiry",
        "future-iat",
        "boolean-iat",
        "unverified",
        "string-verified",
        "invalid-email",
        "blank-sub",
        "unicode-sub",
        "long-sub",
        "missing-nonce",
        "missing-exp",
        "missing-iat",
        "missing-sub",
        "missing-aud",
        "missing-iss",
        "missing-email",
        "missing-email_verified",
        "no-id-token",
        "access-hash",
        "bad-jwks",
        "outage",
    ],
)
def test_g04_crypto_claims_and_provider_failure(google, fault: str) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    provider.fault = fault
    assert_failed(callback(client, state, code))
    assert count(h, users) == 0 and client.get("/api/v1/me").status_code == 401
    calls = len(provider.requests)
    assert_failed(callback(client, state, code))
    assert len(provider.requests) == calls


@pytest.mark.parametrize(
    "fault", ["missing", "wrong", "duplicate", "different-browser", "expired", "cancelled"]
)
def test_g03_invalid_state_before_provider(google, fault: str) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    params = [("state", state), ("code", code)]
    if fault == "missing":
        params = [("code", code)]
    if fault == "wrong":
        params[0] = ("state", secrets.token_urlsafe(32))
    if fault == "duplicate":
        params.append(("state", state))
    if fault == "different-browser":
        client.cookies.clear()
    if fault == "expired":
        h.clock.now += timedelta(minutes=10)
    if fault == "cancelled":
        params = [("state", state), ("error", "access_denied"), ("error_description", "RAW-SECRET")]
    response = client.get(CALLBACK + "?" + urlencode(params), follow_redirects=False)
    assert_failed(response, "cancelled" if fault == "cancelled" else "failed")
    assert not provider.requests and count(h, users) == 0


def test_g05_existing_email_never_links(google) -> None:
    h, provider, client = google
    owner = h.account("google.person@example.com")
    state, code = begin(client, provider)
    assert_failed(callback(client, state, code), "account-conflict")
    assert h.login("google.person@example.com").status_code == 200
    assert h.client.get("/api/v1/me").json()["id"] == owner
    assert client.get("/api/v1/me").status_code == 401
    assert count(h, users) == 1


def test_g06_logged_in_start_and_late_callback_preserve_owner(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    owner = h.account()
    client.cookies.set(
        h.settings.cookie_name,
        h.client.cookies.get(h.settings.cookie_name),
        domain="localhost.local",
        path="/",
    )
    assert client.get(LOGIN, follow_redirects=False).headers["location"] == ORIGIN + "/start"
    assert_failed(callback(client, state, code))
    assert client.get("/api/v1/me").json()["id"] == owner
    assert not provider.requests


def test_g07_google_only_has_no_password_or_recovery_path(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    assert h.login("google.person@example.com").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/password/forgot",
            headers=h.csrf(client),
            json={"email": "google.person@example.com"},
        ).status_code
        == 202
    )
    assert not h.mail.messages and count(h, resets) == 0
    with h.engine.connect() as c:
        user = c.execute(select(users)).mappings().one()
        assert user["google_sub"] == "synthetic-google-sub" and user["password_hash"] is None


def test_g08_sensitive_values_not_stored_or_logged(google, caplog) -> None:
    h, provider, client = google
    caplog.set_level("DEBUG")
    state, code = begin(client, provider)
    assert callback(client, state, code).status_code == 303
    stored = snapshot(h)
    for value in [
        state,
        code,
        keyed(h.settings.security_key.get_secret_value(), "google-pkce", state),
        "synthetic-access-secret",
        "synthetic-client-secret-never-real",
    ]:
        assert value not in stored and value not in caplog.text


def test_g02_stable_sub_does_not_automatically_replace_email_and_key_rotation(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    owner = client.get("/api/v1/me").json()["id"]
    client.post("/api/v1/auth/logout", headers=h.csrf(client))
    provider.rsa = RSAKey.generate_key(2048, parameters={"kid": "rotated"})
    provider.fault = "changed-email"
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    assert client.get("/api/v1/me").json() == {"id": owner, "email": "google.person@example.com"}
    assert count(h, users) == 1
    assert sum(url.endswith("/certs") for _, url in provider.requests) == 2


def test_g05_other_google_sub_same_email_never_links(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    client.post("/api/v1/auth/logout", headers=h.csrf(client))
    state, code = begin(client, provider, "different-sub")
    assert_failed(callback(client, state, code), "account-conflict")
    assert count(h, users) == 1


def test_g05_unverified_pre_registration_does_not_set_google_password(google) -> None:
    h, provider, client = google
    challenge = h.signup("google.person@example.com", password="공격자 선가입 비밀번호 12345")
    signup_code = h.mail.messages[-1][1]
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    assert h.verify(challenge, signup_code).status_code == 400
    assert h.login("google.person@example.com", "공격자 선가입 비밀번호 12345").status_code == 401
    assert count(h, users) == 1


@pytest.mark.parametrize("same_flow", [True, False])
def test_g03_g05_concurrent_callback_consumes_once_and_account_unique(google, same_flow) -> None:
    h, provider, first = google
    second = TestClient(
        create_app(
            h.settings,
            h.engine,
            h.mail,
            h.clock,
            google_transport=httpx2.MockTransport(provider.handle),
        ),
        base_url="http://localhost",
        client=("secondclient", 50000),
    )
    try:
        a = begin(first, provider)
        if same_flow:
            second.cookies.update(first.cookies)
            b = a
        else:
            b = begin(second, provider)
            provider.entered = Barrier(2)
        barrier = Barrier(2)

        def run(pair) -> str:
            client, values = pair
            barrier.wait(timeout=5)
            return callback(client, *values).headers["location"]

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(run, [(first, a), (second, b)]))
        assert results.count(ORIGIN + "/start") == (1 if same_flow else 2)
        assert count(h, users) == 1
        assert sum(url.endswith("/token") for _, url in provider.requests) == (
            1 if same_flow else 2
        )
    finally:
        second.close()


@pytest.mark.parametrize("action", ["expiry", "new-login", "revoke"])
def test_g06_provider_delay_cannot_revive_or_replace_session(google, action) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    old = client.cookies.get(h.settings.cookie_name)

    def during_exchange() -> None:
        if action == "expiry":
            h.clock.now += timedelta(minutes=10)
        elif action == "new-login":
            h.client.cookies.update(client.cookies)
            owner = h.account()
            client.cookies.update(h.client.cookies)
            assert client.get("/api/v1/me").json()["id"] == owner
        else:
            assert client.post("/api/v1/auth/logout", headers=h.csrf(client)).status_code == 204

    provider.action = during_exchange
    assert_failed(callback(client, state, code))
    assert count(h, users) == (1 if action == "new-login" else 0)
    assert client.get("/api/v1/me").status_code == (200 if action == "new-login" else 401)
    with h.engine.connect() as c:
        row = (
            c.execute(select(sessions).where(sessions.c.token_hash == digest(old))).mappings().one()
        )
        assert row["user_id"] is None


def test_g02_latest_attempt_only_and_ip_limit_survives_restart(google) -> None:
    h, provider, client = google
    old = begin(client, provider)
    current = begin(client, provider)
    assert old[0] != current[0]
    assert_failed(callback(client, *old))
    assert not provider.requests and count(h, google_flows) == 1
    for _ in range(8):
        begin(client, provider)
    result = client.get(LOGIN, follow_redirects=False)
    assert result.status_code == 429 and result.headers["retry-after"] == "60"
    restarted = TestClient(
        create_app(
            h.settings,
            h.engine,
            h.mail,
            h.clock,
            google_transport=httpx2.MockTransport(provider.handle),
        ),
        base_url="http://localhost",
    )
    try:
        assert restarted.get(LOGIN, follow_redirects=False).status_code == 429
    finally:
        restarted.close()
    h.clock.now += timedelta(seconds=60)
    begin(client, provider)


def test_g01_partial_and_production_injected_provider_rejected(harness: Harness) -> None:
    h = harness
    for values in [
        {"google_client_id": CLIENT_ID},
        {"google_client_secret": SecretStr("synthetic-only")},
        {
            "google_client_id": "https://attacker.invalid",
            "google_client_secret": SecretStr("synthetic-only"),
        },
    ]:
        with pytest.raises(ValidationError):
            Settings(**{**h.settings.model_dump(), **values})
    development = Settings(**{**h.settings.model_dump(), "environment": "development"})
    with pytest.raises(RuntimeError, match="Test dependencies"):
        create_app(
            development,
            h.engine,
            google_transport=httpx2.MockTransport(lambda _: httpx2.Response(200)),
        )


def test_g07_provider_exclusivity_and_sub_unique_constraints(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    with h.engine.connect() as c:
        row = dict(c.execute(select(users)).mappings().one())
    for changes in [
        {"id": "other", "email": "other@example.com"},
        {"id": "other", "email": "other@example.com", "password_hash": "another-password"},
    ]:
        with pytest.raises(IntegrityError), h.engine.begin() as c:
            c.execute(insert(users).values(**{**row, **changes}))


@pytest.mark.parametrize(
    "fault",
    ["duplicate-code", "duplicate-error", "both", "empty-code", "non-ascii-code", "too-long-code"],
)
def test_g03_bad_callback_parameters_never_call_provider(google, fault: str) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    params = [("state", state), ("code", code)]
    if fault == "duplicate-code":
        params.append(("code", code))
    if fault == "duplicate-error":
        params += [("error", "access_denied"), ("error", "access_denied")]
    if fault == "both":
        params.append(("error", "access_denied"))
    if fault == "empty-code":
        params[-1] = ("code", "")
    if fault == "non-ascii-code":
        params[-1] = ("code", "가상-잘못된-코드")
    if fault == "too-long-code":
        params[-1] = ("code", "x" * 2049)
    assert_failed(client.get(CALLBACK + "?" + urlencode(params), follow_redirects=False))
    assert not provider.requests and count(h, users) == 0


def test_g03_host_next_ignored_and_expiry_just_before_boundary(google) -> None:
    h, provider, client = google
    result = client.get(
        LOGIN + "?next=https://attacker.invalid",
        headers={"Host": "attacker.invalid"},
        follow_redirects=False,
    )
    assert result.status_code == 303
    values = parse_qs(urlsplit(result.headers["location"]).query)
    assert values["redirect_uri"] == [ORIGIN + CALLBACK]
    # A separate normal attempt makes its browser cookie's host unambiguous.
    state, code = begin(client, provider)
    h.clock.now += timedelta(seconds=599.999)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"


def test_g07_local_migration_roundtrip_preserves_email_account(harness: Harness) -> None:
    h = harness
    owner = h.account()
    config = Config("alembic.ini")
    try:
        command.downgrade(config, "0002_password_recovery")
        with h.engine.connect() as c:
            assert c.scalar(text("SELECT id FROM users")) == owner
            assert (
                c.scalar(text("SELECT version_num FROM alembic_version"))
                == "0002_password_recovery"
            )
        command.upgrade(config, "head")
        command.check(config)
        assert h.login().status_code == 200 and h.client.get("/api/v1/me").json()["id"] == owner
    finally:
        command.upgrade(config, "head")


def test_g07_local_downgrade_refuses_google_only_data_loss(google) -> None:
    h, provider, client = google
    state, code = begin(client, provider)
    assert callback(client, state, code).headers["location"] == ORIGIN + "/start"
    with pytest.raises(RuntimeError, match="explicit data rollback"):
        command.downgrade(Config("alembic.ini"), "0002_password_recovery")
    with h.engine.connect() as c:
        assert c.scalar(text("SELECT version_num FROM alembic_version")) == "0003_google_auth"
    assert client.get("/api/v1/me").status_code == 200 and count(h, users) == 1


def test_g01_unconfigured_google_has_no_fallback(harness: Harness) -> None:
    response = harness.client.get("/api/v1/auth/google/status")
    assert response.status_code == 200
    assert response.json() == {"configured": False}
    response = harness.client.get("/api/v1/auth/google/login", follow_redirects=False)
    assert response.status_code == 503
    assert harness.client.get("/api/v1/me").status_code == 401
