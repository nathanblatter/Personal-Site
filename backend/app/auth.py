import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Cookie, HTTPException, status

SECRET_KEY = os.getenv("JWT_SECRET", "change-me")
ALGORITHM = "HS256"
EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


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
