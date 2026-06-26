"""Public service-health aggregator backing the /status page.

Only user-facing infrastructure is reported here. Internal-only services (e.g.
Flightdeck) are intentionally excluded so this public endpoint doesn't disclose
the internal stack — monitor those behind auth if needed.
"""
import time

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils import get_redis

router = APIRouter(prefix="/health", tags=["health"])


async def _timed(coro) -> tuple[bool, int]:
    start = time.monotonic()
    try:
        await coro
        ok = True
    except Exception:
        ok = False
    return ok, round((time.monotonic() - start) * 1000)


@router.get("/services")
async def service_health(db: AsyncSession = Depends(get_db)):
    services = []

    # API itself — if this handler runs, the API is up.
    services.append({"name": "Website & API", "status": "operational", "latency_ms": 0})

    # Database
    ok, ms = await _timed(db.execute(text("SELECT 1")))
    services.append({"name": "Database", "status": "operational" if ok else "down", "latency_ms": ms})

    # Redis
    async def _ping_redis():
        await get_redis().ping()
    ok, ms = await _timed(_ping_redis())
    services.append({"name": "Cache (Redis)", "status": "operational" if ok else "down", "latency_ms": ms})

    overall = "operational" if all(s["status"] == "operational" for s in services) else "degraded"
    return {"overall": overall, "services": services}
