"""Shared Redis cache — replaces per-router in-memory dicts.

Usage:
    from app.cache import cache
    data = await cache.get("github:profile")
    if data is None:
        data = await fetch_from_api()
        await cache.set("github:profile", data, ttl=3600)
"""

import json
import logging
import os
from typing import Any

import redis.asyncio as aioredis

log = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


class RedisCache:
    _redis: aioredis.Redis | None = None

    async def _conn(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        return self._redis

    async def get(self, key: str) -> Any | None:
        try:
            r = await self._conn()
            raw = await r.get(f"cache:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            log.debug("cache miss (redis error) key=%s", key)
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        try:
            r = await self._conn()
            await r.set(f"cache:{key}", json.dumps(value, default=str), ex=ttl)
        except Exception:
            log.debug("cache set failed key=%s", key)

    async def delete(self, key: str) -> None:
        try:
            r = await self._conn()
            await r.delete(f"cache:{key}")
        except Exception:
            pass

    async def delete_prefix(self, prefix: str) -> None:
        try:
            r = await self._conn()
            keys = []
            async for k in r.scan_iter(f"cache:{prefix}*"):
                keys.append(k)
            if keys:
                await r.delete(*keys)
        except Exception:
            pass


cache = RedisCache()
