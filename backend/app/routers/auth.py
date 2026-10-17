"""Admin sign-in.

Production signs in through Squawk (Nathan's auth service): `/auth/start` sends
the browser to Squawk's `/oauth/authorize` with PKCE; Squawk parks the request
and sends the browser back to our login page with a `login_challenge`; the page
completes a passkey or emailed-code ceremony through the proxy endpoints below;
Squawk redirects to `/auth/callback` with a code; we exchange it, verify the
user token and mint the site's own `auth_token` cookie.

Without `SQUAWK_ISSUER` (local dev) the legacy username/password login stays
on. With Squawk configured it answers 404 unless `ADMIN_PASSWORD_LOGIN=true`
(break-glass).
"""

import base64
import hashlib
import logging
import os
import secrets
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field

from app import squawk
from app.auth import EXPIRE_DAYS, COOKIE_SECURE, check_admin_credentials, create_token, require_auth
from app.cache import cache
from app.utils import get_client_ip

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP login throttle (brute-force defense). Fails open if Redis is unavailable.
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "10"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))  # 15 min

STATE_TTL_SECONDS = 300
LOGIN_PAGE = "/admin/login"
ADMIN_PAGE = "/admin"


def password_login_enabled() -> bool:
    """Password login is the fallback without Squawk, or an explicit break-glass."""
    return not squawk.enabled() or os.getenv("ADMIN_PASSWORD_LOGIN", "").lower() == "true"


async def login_rate_limit(request: Request) -> None:
    ip = get_client_ip(request)
    key = f"cache:rl:login:{ip}"
    try:
        r = await cache._conn()
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, LOGIN_WINDOW_SECONDS)
    except Exception:
        return  # never lock out admin because Redis is down
    if n > LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail={"error": "too_many_attempts", "message": "Too many login attempts. Try again later."},
        )


def require_squawk() -> None:
    if not squawk.enabled():
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Squawk sign-in is not configured"})


def _set_session_cookie(response: Response, sub: str | None = None) -> None:
    response.set_cookie(
        key="auth_token",
        value=create_token(sub=sub),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=EXPIRE_DAYS * 86400,
        path="/",
    )


# ── Config ──────────────────────────────────────────────────────────────────

@router.get("/config")
def config() -> dict[str, Any]:
    """What the login page should render."""
    return {
        "mode": "squawk" if squawk.enabled() else "password",
        "password_login": password_login_enabled(),
    }


# ── Legacy password login (dev fallback / break-glass) ──────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", status_code=204)
def login(payload: LoginRequest, response: Response, _: None = Depends(login_rate_limit)):
    if not password_login_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    if not check_admin_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_session_cookie(response)


@router.get("/verify", status_code=204)
def verify(_: None = Depends(require_auth)):
    pass


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("auth_token", path="/")


# ── Squawk: start → login page → callback ───────────────────────────────────

def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)  # 86 chars, within RFC 7636's 43–128
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _login_error(code: str) -> RedirectResponse:
    return RedirectResponse(f"{LOGIN_PAGE}?{urlencode({'error': code})}", status_code=302)


@router.get("/start", dependencies=[Depends(require_squawk)])
async def start():
    """Begin the Squawk authorization: 302 to /oauth/authorize with PKCE."""
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(32)
    await cache.set(f"squawk:state:{state}", {"verifier": verifier}, ttl=STATE_TTL_SECONDS)
    params = {
        "response_type": "code",
        "client_id": squawk.CLIENT_ID,
        "redirect_uri": squawk.redirect_uri(),
        "state": state,
        "resource": squawk.RESOURCE,
        "scope": "admin",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"{squawk.ISSUER}/oauth/authorize?{urlencode(params)}", status_code=302)


@router.get("/callback", dependencies=[Depends(require_squawk)])
async def callback(code: str | None = None, state: str | None = None, error: str | None = None):
    """Squawk sends the browser here with `code` + `state`. Exchange, verify,
    set the admin cookie, land on /admin. Any failure → login page with ?error=."""
    if error:
        return _login_error(error)
    if not code or not state:
        return _login_error("invalid_request")
    stashed = await cache.get(f"squawk:state:{state}")
    if not stashed or "verifier" not in stashed:
        return _login_error("state_mismatch")
    await cache.delete(f"squawk:state:{state}")  # single use
    try:
        tokens = await squawk.exchange_code(code, stashed["verifier"])
    except squawk.SquawkError as e:
        log.warning("squawk code exchange failed: %s", e)
        return _login_error(e.code)
    except Exception:
        log.exception("squawk code exchange error")
        return _login_error("server_error")
    claims = await squawk.verifier().verify(tokens.get("access_token", ""))
    if claims is None:
        log.warning("squawk access token failed verification")
        return _login_error("invalid_token")
    response = RedirectResponse(ADMIN_PAGE, status_code=302)
    _set_session_cookie(response, sub=claims["sub"])
    log.info("admin signed in via squawk sub=%s", claims["sub"])
    return response


# ── Squawk: ceremony proxies for the login page ─────────────────────────────

_ERROR_MESSAGES = {
    "code_rejected": "That code is wrong or expired. Request a new one.",
    "passkey_rejected": "Passkey not recognized.",
    "signup_closed": "No account exists for that address.",
    "account_disabled": "That account is disabled.",
    "email_unverified": "That account has not verified its email.",
    "too_many_attempts": "Too many attempts. Try again later.",
    "not_found": "This sign-in attempt expired. Start over.",
    "email_disabled": "Email sign-in is unavailable right now.",
}


def _map_squawk_error(e: squawk.SquawkError) -> HTTPException:
    status = e.status if e.status in (400, 401, 403, 404, 409, 429) else 502
    headers = {"Retry-After": str(e.retry_after)} if e.status == 429 and e.retry_after else None
    message = _ERROR_MESSAGES.get(e.code) or e.detail or "Sign-in failed."
    if status == 502:
        log.warning("squawk upstream error: %s", e)
        message = "Sign-in service unavailable. Try again."
    return HTTPException(status_code=status, detail={"error": e.code, "message": message}, headers=headers)


async def _proxy(coro):
    try:
        return await coro
    except squawk.SquawkError as e:
        raise _map_squawk_error(e)
    except Exception:
        log.exception("squawk request error")
        raise HTTPException(status_code=502, detail={"error": "server_error", "message": "Sign-in service unavailable. Try again."})


class EmailBegin(BaseModel):
    login_challenge: str = Field(min_length=1, max_length=256)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailFinish(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=256)
    code: str = Field(pattern=r"^\d{6}$")


class PasskeyBegin(BaseModel):
    login_challenge: str = Field(min_length=1, max_length=256)


class PasskeyFinish(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=256)
    credential: dict[str, Any]


class PasskeySetupBegin(BaseModel):
    login_challenge: str = Field(min_length=1, max_length=256)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PasskeySetupFinish(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=256)
    code: str = Field(pattern=r"^\d{6}$")


class PasskeySetupRegister(BaseModel):
    user_id: str = Field(pattern=r"^usr_[A-Za-z0-9_-]{1,64}$")
    challenge_id: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=64)
    credential: dict[str, Any]


class Redirect(BaseModel):
    redirect_to: str


_squawk_deps = [Depends(require_squawk), Depends(login_rate_limit)]


@router.post("/email/begin", dependencies=_squawk_deps)
async def email_begin(payload: EmailBegin) -> dict[str, Any]:
    out = await _proxy(squawk.login_email_begin(payload.login_challenge, payload.email))
    return {"challenge_id": out["challenge_id"], "expires_in": out.get("expires_in", 600)}


@router.post("/email/finish", dependencies=_squawk_deps, response_model=Redirect)
async def email_finish(payload: EmailFinish):
    out = await _proxy(squawk.login_email_finish(payload.challenge_id, payload.code))
    return {"redirect_to": out["redirect_to"]}


@router.post("/passkey/begin", dependencies=_squawk_deps)
async def passkey_begin(payload: PasskeyBegin) -> dict[str, Any]:
    out = await _proxy(squawk.login_passkey_begin(payload.login_challenge))
    return {"challenge_id": out["challenge_id"], "options": out["options"]}


@router.post("/passkey/finish", dependencies=_squawk_deps, response_model=Redirect)
async def passkey_finish(payload: PasskeyFinish):
    out = await _proxy(squawk.login_passkey_finish(payload.challenge_id, payload.credential))
    return {"redirect_to": out["redirect_to"]}


# ── Squawk: first-device passkey setup (emailed code → create → register) ──

@router.post("/passkey/setup/begin", dependencies=_squawk_deps)
async def passkey_setup_begin(payload: PasskeySetupBegin) -> dict[str, Any]:
    out = await _proxy(squawk.passkey_activate_begin(payload.login_challenge, payload.email))
    return {"challenge_id": out["challenge_id"], "expires_in": out.get("expires_in", 600)}


@router.post("/passkey/setup/finish", dependencies=_squawk_deps)
async def passkey_setup_finish(payload: PasskeySetupFinish) -> dict[str, Any]:
    out = await _proxy(squawk.passkey_activate_finish(payload.challenge_id, payload.code))
    return {"challenge_id": out["challenge_id"], "options": out["options"], "user_id": out["user"]["id"]}


@router.post("/passkey/setup/register", dependencies=_squawk_deps, response_model=Redirect)
async def passkey_setup_register(payload: PasskeySetupRegister):
    out = await _proxy(squawk.passkey_register_finish(payload.user_id, payload.challenge_id, payload.name, payload.credential))
    return {"redirect_to": out["redirect_to"]}
