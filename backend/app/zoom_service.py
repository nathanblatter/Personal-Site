import base64
import logging
import os
from datetime import datetime

import httpx
from redis.asyncio import Redis

log = logging.getLogger(__name__)

ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID", "")
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID", "")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_redis: Redis | None = None


def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis


def _is_configured() -> bool:
    return bool(ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET and ZOOM_ACCOUNT_ID)


async def _get_token() -> str | None:
    if not _is_configured():
        return None

    redis = _get_redis()
    cached = await redis.get("zoom:token")
    if cached:
        return cached

    creds = base64.b64encode(f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://zoom.us/oauth/token",
            headers={"Authorization": f"Basic {creds}"},
            data={"grant_type": "account_credentials", "account_id": ZOOM_ACCOUNT_ID},
        )
        resp.raise_for_status()
        data = resp.json()

    token = data["access_token"]
    await redis.set("zoom:token", token, ex=3300)  # cache ~55 min
    return token


async def create_meeting(topic: str, start_at: datetime, duration_minutes: int) -> dict | None:
    """Create a Zoom meeting. Returns {join_url, meeting_id} or None if not configured."""
    token = await _get_token()
    if not token:
        log.info("Zoom not configured, skipping meeting creation")
        return None

    payload = {
        "topic": topic,
        "type": 2,  # scheduled
        "start_time": start_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration": duration_minutes,
        "timezone": "UTC",
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.zoom.us/v2/users/me/meetings",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    return {"join_url": data["join_url"], "meeting_id": str(data["id"])}


async def delete_meeting(meeting_id: str) -> bool:
    """Delete a Zoom meeting. Returns True on success."""
    token = await _get_token()
    if not token:
        return False

    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"https://api.zoom.us/v2/meetings/{meeting_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    return resp.status_code in (200, 204, 404)
