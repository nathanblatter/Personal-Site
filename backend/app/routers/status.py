import logging
import os
import time
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.cache import cache

log = logging.getLogger(__name__)

router = APIRouter(tags=["status"])

# Keyed by source name e.g. "mini", "laptop"
_sources: dict[str, dict] = {}
STALE_AFTER = 120  # seconds

_TYPE_PRIORITY = {"both": 0, "ssh": 1, "vnc": 2, "laptop": 3, "none": 4}


def _verify_dev_status_key(x_api_key: Optional[str] = Header(None)) -> None:
    if x_api_key != os.getenv("DEV_STATUS_API_KEY"):
        raise HTTPException(status_code=401, detail="Unauthorized")


class DevStatusPayload(BaseModel):
    active: bool
    type: str        # "ssh" | "vnc" | "both" | "laptop" | "none"
    source: str = "mini"


@router.post("/dev", status_code=204)
async def update_dev_status(
    payload: DevStatusPayload,
    x_api_key: Optional[str] = Header(None),
):
    _verify_dev_status_key(x_api_key)
    _sources[payload.source] = {
        "last_ping": time.monotonic(),
        "active": payload.active,
        "type": payload.type,
    }
    return Response(status_code=204)


@router.get("")
async def get_status():
    now = time.monotonic()
    active = [
        s for s in _sources.values()
        if s["active"] and (now - s["last_ping"]) <= STALE_AFTER
    ]
    if active:
        best = min(active, key=lambda s: _TYPE_PRIORITY.get(s["type"], 99))
        return {"dev_active": True, "dev_type": best["type"], "stale": False}

    all_stale = not _sources or all(
        (now - s["last_ping"]) > STALE_AFTER for s in _sources.values()
    )
    return {"dev_active": False, "dev_type": "none", "stale": all_stale}


@router.get("/healthz", include_in_schema=False)
async def healthz():
    checks = {"db": "ok", "redis": "ok"}

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        log.warning("healthz db check failed: %s", exc)
        checks["db"] = "fail"

    try:
        r = await cache._conn()
        await r.ping()
    except Exception as exc:
        log.warning("healthz redis check failed: %s", exc)
        checks["redis"] = "fail"

    healthy = all(v == "ok" for v in checks.values())
    return Response(
        content='{"status":"healthy"}' if healthy else '{"status":"unhealthy","checks":' + str(checks).replace("'", '"') + '}',
        status_code=200 if healthy else 503,
        media_type="application/json",
    )
