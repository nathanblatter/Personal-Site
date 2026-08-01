import os
import re
from typing import Any

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


def experience_sort_key(exp: Any) -> tuple:
    """Single source of truth for ordering `Experience` rows everywhere they're
    rendered (About tab, /resume page, /about-page + /resume/data aggregates).

    Ongoing entries (`active=True` — no end date, e.g. a current program or job)
    sort first, most-recently-started first. Ended entries follow, most-recently-
    ended first. The `year` column is a free-text display string (e.g.
    "2023 — Present"), so we pull out the 4-digit years embedded in it to derive
    a start/end year to sort by; `sort_order` is the final tiebreaker so admin
    drag-reorder still has an effect among entries that tie on year.
    """
    years = [int(y) for y in re.findall(r"\d{4}", exp.year or "")]
    start_year = years[0] if years else 0
    end_year = years[-1] if len(years) > 1 else start_year

    is_ongoing = bool(exp.active)
    order_year = start_year if is_ongoing else end_year
    return (0 if is_ongoing else 1, -order_year, exp.sort_order)


def sort_experience(rows: Any) -> list:
    """Sort an iterable of `Experience` rows per `experience_sort_key`."""
    return sorted(rows, key=experience_sort_key)
