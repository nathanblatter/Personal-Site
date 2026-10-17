"""Admin sign-in through Squawk, with Squawk itself mocked at the httpx layer."""
import hashlib
import base64
import json
import time
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import squawk
from app.auth import ALGORITHM, SECRET_KEY
from app.routers import auth as auth_router

ISSUER = "https://squawk.example.test"
SERVICE_ID = "svc_personalsite"
CLIENT_ID = "nbc_test"
RESOURCE = "https://site.example.test/api"
SITE = "https://site.example.test"


class FakeCache:
    """In-memory stand-in for app.cache.cache. `_conn` raises so the per-IP rate
    limit fails open exactly as it does without Redis."""

    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl=300):
        self.store[key] = json.loads(json.dumps(value))

    async def delete(self, key):
        self.store.pop(key, None)

    async def _conn(self):
        raise ConnectionError("no redis in tests")


@pytest.fixture(scope="session")
def signing_key():
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(scope="session")
def other_key():
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture
def mint(signing_key):
    """Mint a user token the way Squawk does."""

    def _mint(key=None, **overrides):
        now = int(time.time())
        claims = {
            "iss": ISSUER,
            "sub": "usr_abc".replace("usr_", "usr:"),
            "aud": SERVICE_ID,
            "scope": "admin",
            "client_id": CLIENT_ID,
            "email": "nathan@example.test",
            "email_verified": True,
            "iat": now,
            "exp": now + 3600,
            "jti": "x",
        }
        claims.update(overrides)
        claims = {k: v for k, v in claims.items() if v is not None}
        return jwt.encode(claims, key or signing_key, algorithm="ES256", headers={"kid": "k1", "typ": "at+jwt"})

    return _mint


@pytest.fixture
def fake_cache(monkeypatch):
    fc = FakeCache()
    monkeypatch.setattr(auth_router, "cache", fc)
    return fc


@pytest.fixture
def squawk_env(monkeypatch, signing_key):
    """Configure Squawk and route every outbound call to `handler`."""
    monkeypatch.setattr(squawk, "ISSUER", ISSUER)
    monkeypatch.setattr(squawk, "SERVICE_ID", SERVICE_ID)
    monkeypatch.setattr(squawk, "CREDENTIAL", "nbk_test_secret")
    monkeypatch.setattr(squawk, "CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(squawk, "RESOURCE", RESOURCE)
    monkeypatch.setattr(squawk, "SITE_URL", SITE)
    monkeypatch.delenv("ADMIN_PASSWORD_LOGIN", raising=False)
    squawk._reset_service_token()
    monkeypatch.setattr(
        squawk, "_verifier",
        squawk.UserTokenVerifier(ISSUER, SERVICE_ID, key_resolver=lambda _tok: signing_key.public_key()),
    )
    calls = []

    class Env:
        handler = None  # set by each test: (httpx.Request) -> httpx.Response

    def dispatch(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.url.path == "/v1/token" and b"client_credentials" in req.content:
            form = parse_qs(req.content.decode())
            assert form["client_id"] == [SERVICE_ID] and form["client_secret"] == ["nbk_test_secret"]
            return httpx.Response(200, json={"access_token": "svc-token", "token_type": "Bearer", "expires_in": 900})
        assert Env.handler is not None, f"unexpected squawk call {req.method} {req.url}"
        return Env.handler(req)

    monkeypatch.setattr(squawk, "_make_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(dispatch)))
    Env.calls = calls
    return Env


@pytest.fixture
def client(fake_cache):
    app = FastAPI()
    app.include_router(auth_router.router)
    return TestClient(app, follow_redirects=False)


# ── /auth/start ─────────────────────────────────────────────────────────────

def test_start_redirects_with_pkce_and_stashes_state(client, fake_cache, squawk_env):
    r = client.get("/auth/start")
    assert r.status_code == 302
    url = urlparse(r.headers["location"])
    assert f"{url.scheme}://{url.netloc}{url.path}" == f"{ISSUER}/oauth/authorize"
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert q["response_type"] == "code"
    assert q["client_id"] == CLIENT_ID
    assert q["redirect_uri"] == f"{SITE}/api/v1/auth/callback"
    assert q["resource"] == RESOURCE
    assert q["scope"] == "admin"
    assert q["code_challenge_method"] == "S256"
    stashed = fake_cache.store[f"squawk:state:{q['state']}"]
    expected = base64.urlsafe_b64encode(hashlib.sha256(stashed["verifier"].encode()).digest()).rstrip(b"=").decode()
    assert q["code_challenge"] == expected
    assert 43 <= len(stashed["verifier"]) <= 128


def test_start_404_without_squawk(client, monkeypatch):
    monkeypatch.setattr(squawk, "ISSUER", "")
    assert client.get("/auth/start").status_code == 404


# ── /auth/callback ──────────────────────────────────────────────────────────

def _stash_state(fake_cache, state="st4te", verifier="v" * 50):
    fake_cache.store[f"squawk:state:{state}"] = {"verifier": verifier}


def _exchange_handler(token, seen):
    def handler(req: httpx.Request):
        assert req.url.path == "/oauth/token"
        seen.update({k: v[0] for k, v in parse_qs(req.content.decode()).items()})
        return httpx.Response(200, json={"access_token": token, "token_type": "Bearer", "expires_in": 3600})
    return handler


def test_callback_happy_path_sets_cookie(client, fake_cache, squawk_env, mint):
    _stash_state(fake_cache)
    seen = {}
    squawk_env.handler = _exchange_handler(mint(), seen)
    r = client.get("/auth/callback?code=nbac_1&state=st4te")
    assert r.status_code == 302 and r.headers["location"] == "/admin"
    assert seen == {
        "grant_type": "authorization_code", "client_id": CLIENT_ID, "code": "nbac_1",
        "code_verifier": "v" * 50, "redirect_uri": f"{SITE}/api/v1/auth/callback",
    }
    cookie = r.cookies.get("auth_token")
    assert cookie
    claims = jwt.decode(cookie, SECRET_KEY, algorithms=[ALGORITHM])
    assert claims["sub"] == "usr:abc"
    assert "httponly" in r.headers["set-cookie"].lower()
    # State is single-use.
    assert f"squawk:state:st4te" not in fake_cache.store


@pytest.mark.parametrize("bad", [
    {"aud": "svc_other"},
    {"iss": "https://evil.example.test"},
    {"sub": "owner"},
    {"email_verified": False},
    {"exp": int(time.time()) - 600},
])
def test_callback_rejects_bad_token(client, fake_cache, squawk_env, mint, bad):
    _stash_state(fake_cache)
    squawk_env.handler = _exchange_handler(mint(**bad), {})
    r = client.get("/auth/callback?code=nbac_1&state=st4te")
    assert r.status_code == 302
    assert r.headers["location"] == "/admin/login?error=invalid_token"
    assert "auth_token" not in r.cookies


def test_callback_rejects_wrong_signing_key(client, fake_cache, squawk_env, mint, other_key):
    _stash_state(fake_cache)
    squawk_env.handler = _exchange_handler(mint(key=other_key), {})
    r = client.get("/auth/callback?code=nbac_1&state=st4te")
    assert r.headers["location"] == "/admin/login?error=invalid_token"
    assert "auth_token" not in r.cookies


def test_callback_unknown_state(client, fake_cache, squawk_env):
    r = client.get("/auth/callback?code=nbac_1&state=nope")
    assert r.status_code == 302 and r.headers["location"] == "/admin/login?error=state_mismatch"
    assert squawk_env.calls == []  # never talked to Squawk


def test_callback_exchange_error_maps_code(client, fake_cache, squawk_env):
    _stash_state(fake_cache)
    squawk_env.handler = lambda req: httpx.Response(400, json={"error": "invalid_grant", "error_description": "used"})
    r = client.get("/auth/callback?code=nbac_1&state=st4te")
    assert r.headers["location"] == "/admin/login?error=invalid_grant"
    assert "auth_token" not in r.cookies


def test_callback_passes_through_squawk_error_param(client, fake_cache, squawk_env):
    r = client.get("/auth/callback?error=access_denied&state=x")
    assert r.headers["location"] == "/admin/login?error=access_denied"


# ── Email code proxies ──────────────────────────────────────────────────────

def test_email_begin_proxies_with_service_token(client, fake_cache, squawk_env):
    seen = {}

    def handler(req: httpx.Request):
        assert req.url.path == "/v1/login/email/begin"
        seen["auth"] = req.headers["authorization"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"challenge_id": "ch_1", "expires_in": 600})

    squawk_env.handler = handler
    r = client.post("/auth/email/begin", json={"login_challenge": "lc_1", "email": "nathan@example.test"})
    assert r.status_code == 200 and r.json() == {"challenge_id": "ch_1", "expires_in": 600}
    assert seen == {"auth": "Bearer svc-token", "body": {"login_challenge": "lc_1", "email": "nathan@example.test"}}
    # Service token was minted once and reused.
    assert [c.url.path for c in squawk_env.calls] == ["/v1/token", "/v1/login/email/begin"]


def test_email_begin_signup_closed_maps_to_403(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(403, json={"error": "signup_closed", "detail": "..."})
    r = client.post("/auth/email/begin", json={"login_challenge": "lc_1", "email": "stranger@example.test"})
    assert r.status_code == 403
    assert r.json()["detail"]["error"] == "signup_closed"
    assert "No account" in r.json()["detail"]["message"]


def test_email_begin_rate_limited_maps_to_429(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(429, json={"error": "too_many_attempts"}, headers={"Retry-After": "120"})
    r = client.post("/auth/email/begin", json={"login_challenge": "lc_1", "email": "nathan@example.test"})
    assert r.status_code == 429 and r.headers["retry-after"] == "120"
    assert r.json()["detail"]["error"] == "too_many_attempts"


def test_email_finish_returns_redirect(client, fake_cache, squawk_env):
    seen = {}

    def handler(req: httpx.Request):
        assert req.url.path == "/v1/login/email/finish"
        seen["challenge"] = req.url.params["challenge"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"redirect_to": f"{SITE}/api/v1/auth/callback?code=nbac_9&state=s", "user": {"id": "usr_1"}})

    squawk_env.handler = handler
    r = client.post("/auth/email/finish", json={"challenge_id": "ch_1", "code": "123456"})
    assert r.status_code == 200
    assert r.json() == {"redirect_to": f"{SITE}/api/v1/auth/callback?code=nbac_9&state=s"}
    assert seen == {"challenge": "ch_1", "body": {"code": "123456"}}


def test_email_finish_code_rejected_maps_to_401(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(401, json={"error": "code_rejected", "detail": "wrong code; try again"})
    r = client.post("/auth/email/finish", json={"challenge_id": "ch_1", "code": "000000"})
    assert r.status_code == 401 and r.json()["detail"]["error"] == "code_rejected"


def test_email_finish_validates_code_shape(client, fake_cache, squawk_env):
    r = client.post("/auth/email/finish", json={"challenge_id": "ch_1", "code": "12ab"})
    assert r.status_code == 422
    assert squawk_env.calls == []


def test_squawk_down_maps_to_502(client, fake_cache, squawk_env):
    def handler(req):
        raise httpx.ConnectError("refused")
    squawk_env.handler = handler
    r = client.post("/auth/email/begin", json={"login_challenge": "lc_1", "email": "nathan@example.test"})
    assert r.status_code == 502 and r.json()["detail"]["error"] == "server_error"


# ── Passkey proxies ─────────────────────────────────────────────────────────

def test_passkey_begin_and_finish(client, fake_cache, squawk_env):
    options = {"publicKey": {"challenge": "Y2hhbGxlbmdl", "rpId": "site.example.test", "userVerification": "required"}}
    seen = {}

    def handler(req: httpx.Request):
        if req.url.path == "/v1/login/passkey/begin":
            assert json.loads(req.content) == {"login_challenge": "lc_1"}
            return httpx.Response(200, json={"challenge_id": "ch_pk", "options": options})
        assert req.url.path == "/v1/login/passkey/finish"
        seen["challenge"] = req.url.params["challenge"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"redirect_to": f"{SITE}/api/v1/auth/callback?code=c&state=s", "user": {}})

    squawk_env.handler = handler
    r = client.post("/auth/passkey/begin", json={"login_challenge": "lc_1"})
    assert r.status_code == 200 and r.json() == {"challenge_id": "ch_pk", "options": options}
    cred = {"id": "abc", "rawId": "abc", "type": "public-key", "response": {"clientDataJSON": "e30"}}
    r = client.post("/auth/passkey/finish", json={"challenge_id": "ch_pk", "credential": cred})
    assert r.status_code == 200 and r.json()["redirect_to"].endswith("code=c&state=s")
    assert seen == {"challenge": "ch_pk", "body": cred}


def test_passkey_rejected_maps_to_401(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(401, json={"error": "passkey_rejected"})
    r = client.post("/auth/passkey/finish", json={"challenge_id": "ch_pk", "credential": {"id": "x"}})
    assert r.status_code == 401 and r.json()["detail"]["error"] == "passkey_rejected"


# ── First-device passkey setup ──────────────────────────────────────────────

def test_passkey_setup_full_flow(client, fake_cache, squawk_env):
    creation = {"publicKey": {"challenge": "Y2g", "rp": {"id": "site.example.test"}, "user": {"id": "dXNy", "name": "n"}}}
    cred = {"id": "abc", "rawId": "abc", "type": "public-key",
            "response": {"clientDataJSON": "e30", "attestationObject": "o2M", "transports": ["internal"]}}
    seen = {}

    def handler(req: httpx.Request):
        body = json.loads(req.content)
        if req.url.path == "/v1/login/passkey/activate/begin":
            assert body == {"login_challenge": "lc_1", "email": "nathan@example.test"}
            return httpx.Response(200, json={"challenge_id": "ch_act", "expires_in": 600})
        if req.url.path == "/v1/login/passkey/activate/finish":
            seen["finish"] = (req.url.params["challenge"], body)
            return httpx.Response(200, json={"challenge_id": "ch_reg", "options": creation, "user": {"id": "usr_9", "email": "nathan@example.test"}})
        assert req.url.path == "/v1/users/usr_9/passkeys/finish"
        seen["register"] = (dict(req.url.params), body)
        return httpx.Response(201, json={"id": "pk_1", "name": "Mac", "user_id": "usr_9", "created_at": "2026-10-16T00:00:00Z",
                                         "redirect_to": f"{SITE}/api/v1/auth/callback?code=c&state=s"})

    squawk_env.handler = handler
    r = client.post("/auth/passkey/setup/begin", json={"login_challenge": "lc_1", "email": "nathan@example.test"})
    assert r.status_code == 200 and r.json() == {"challenge_id": "ch_act", "expires_in": 600}
    r = client.post("/auth/passkey/setup/finish", json={"challenge_id": "ch_act", "code": "123456"})
    assert r.status_code == 200 and r.json() == {"challenge_id": "ch_reg", "options": creation, "user_id": "usr_9"}
    assert seen["finish"] == ("ch_act", {"code": "123456"})
    r = client.post("/auth/passkey/setup/register", json={"user_id": "usr_9", "challenge_id": "ch_reg", "name": "Mac", "credential": cred})
    assert r.status_code == 200 and r.json()["redirect_to"].endswith("code=c&state=s")
    assert seen["register"] == ({"challenge": "ch_reg", "name": "Mac"}, cred)


def test_passkey_setup_begin_no_account(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(403, json={"error": "signup_closed"})
    r = client.post("/auth/passkey/setup/begin", json={"login_challenge": "lc_1", "email": "x@example.test"})
    assert r.status_code == 403 and r.json()["detail"]["error"] == "signup_closed"


def test_passkey_setup_finish_code_rejected(client, fake_cache, squawk_env):
    squawk_env.handler = lambda req: httpx.Response(401, json={"error": "code_rejected"})
    r = client.post("/auth/passkey/setup/finish", json={"challenge_id": "ch_act", "code": "000000"})
    assert r.status_code == 401 and r.json()["detail"]["error"] == "code_rejected"


def test_passkey_setup_register_rejects_bad_user_id(client, fake_cache, squawk_env):
    r = client.post("/auth/passkey/setup/register", json={"user_id": "../admin", "challenge_id": "c", "name": "n", "credential": {}})
    assert r.status_code == 422 and squawk_env.calls == []


# ── Service token cache ─────────────────────────────────────────────────────

def test_service_token_refreshes_near_expiry(client, fake_cache, squawk_env, monkeypatch):
    squawk_env.handler = lambda req: httpx.Response(200, json={"challenge_id": "ch", "expires_in": 600})
    body = {"login_challenge": "lc", "email": "nathan@example.test"}
    client.post("/auth/email/begin", json=body)
    client.post("/auth/email/begin", json=body)
    assert [c.url.path for c in squawk_env.calls].count("/v1/token") == 1
    # Jump to 20 s before expiry: inside the 30 s refresh margin → re-mint.
    monkeypatch.setattr(squawk, "_service_token_exp", time.time() + 20)
    client.post("/auth/email/begin", json=body)
    assert [c.url.path for c in squawk_env.calls].count("/v1/token") == 2


# ── Password login gating + config ──────────────────────────────────────────

def test_password_login_404_when_squawk_configured(client, fake_cache, squawk_env):
    r = client.post("/auth/login", json={"username": "nathan", "password": "x"})
    assert r.status_code == 404
    assert client.get("/auth/config").json() == {"mode": "squawk", "password_login": False}


def test_password_login_break_glass(client, fake_cache, squawk_env, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD_LOGIN", "true")
    assert client.get("/auth/config").json() == {"mode": "squawk", "password_login": True}
    r = client.post("/auth/login", json={"username": "nathan", "password": "wrong"})
    assert r.status_code == 401  # reachable again; credentials still checked


def test_password_login_without_squawk(client, fake_cache, monkeypatch):
    monkeypatch.setattr(squawk, "ISSUER", "")
    monkeypatch.setattr(auth_router, "check_admin_credentials", lambda u, p: True)
    assert client.get("/auth/config").json() == {"mode": "password", "password_login": True}
    r = client.post("/auth/login", json={"username": "nathan", "password": "pw"})
    assert r.status_code == 204 and r.cookies.get("auth_token")
    assert client.post("/auth/email/begin", json={"login_challenge": "x", "email": "a@b.co"}).status_code == 404
