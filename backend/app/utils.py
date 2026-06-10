import os

from fastapi import Request
from redis.asyncio import Redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_redis: Redis | None = None


def get_client_ip(request: Request) -> str:
    """Extract real client IP from proxy headers."""
    for header in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        val = request.headers.get(header)
        if val:
            return val.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def get_redis() -> Redis:
    """Shared lazy-initialized Redis client."""
    global _redis
    if _redis is None:
        _redis = Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis
