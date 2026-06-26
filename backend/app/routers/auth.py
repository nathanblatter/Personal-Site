import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from app.auth import EXPIRE_DAYS, COOKIE_SECURE, check_admin_credentials, create_token, require_auth
from app.cache import cache
from app.utils import get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP login throttle (brute-force defense). Fails open if Redis is unavailable.
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "10"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))  # 15 min


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
            detail="Too many login attempts. Try again later.",
        )


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", status_code=204)
def login(payload: LoginRequest, response: Response, _: None = Depends(login_rate_limit)):
    if not check_admin_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    response.set_cookie(
        key="auth_token",
        value=create_token(),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=EXPIRE_DAYS * 86400,
        path="/",
    )


@router.get("/verify", status_code=204)
def verify(_: None = Depends(require_auth)):
    pass


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("auth_token", path="/")
