import hmac
import logging
import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Cookie, HTTPException, status

log = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET", "change-me")
ALGORITHM = "HS256"
EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# Values that must never be used in production.
_INSECURE_VALUES = {"", "change-me", "minioadmin", "minioadmin123"}


def assert_secure_secrets() -> None:
    """Refuse to boot in production with default/empty secrets. Warns in dev.

    Called at startup. A leaked or unchanged JWT_SECRET/ADMIN_PASSWORD is a full
    compromise, so in production we fail closed rather than serve with defaults.
    """
    checks = {
        "JWT_SECRET": SECRET_KEY,
        "ADMIN_PASSWORD": ADMIN_PASSWORD,
        "MINIO_SECRET_KEY": os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_ROOT_PASSWORD", ""),
    }
    insecure = [name for name, val in checks.items() if (val or "").strip().lower() in _INSECURE_VALUES]
    if not insecure:
        return
    msg = f"Insecure default/empty secrets: {', '.join(insecure)}"
    if ENVIRONMENT == "production":
        raise RuntimeError(f"Refusing to start in production — {msg}. Set them in .env.prod.")
    log.warning("%s (allowed because ENVIRONMENT=%s)", msg, ENVIRONMENT)


def check_admin_credentials(username: str, password: str) -> bool:
    """Constant-time credential check (avoids username/password timing leaks)."""
    user_ok = hmac.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    pass_ok = hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    return user_ok and pass_ok


def create_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    return jwt.encode({"sub": ADMIN_USERNAME, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def require_auth(auth_token: str | None = Cookie(default=None)):
    if auth_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def create_action_token(action: str, booking_id: int, hours: int = 72) -> str:
    """Create a short-lived JWT for a specific booking action (accept/decline/cancel)."""
    exp = datetime.now(timezone.utc) + timedelta(hours=hours)
    return jwt.encode(
        {"action": action, "booking_id": booking_id, "exp": exp},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def verify_action_token(token: str) -> dict:
    """Verify and return payload from an action token. Raises on invalid/expired."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired link")
