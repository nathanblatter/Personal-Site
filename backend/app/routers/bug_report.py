"""Bug report router — forwards visitor-submitted bugs to the flightdeck board.

The flightdeck ingest key lives only on the server (never in the client bundle);
the browser calls this same-origin endpoint and we forward to flightdeck over the
shared docker network.
"""

import logging
import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("portfolio.bug_report")

router = APIRouter(prefix="/bug-report", tags=["bug-report"])

FLIGHTDECK_URL = os.getenv("FLIGHTDECK_URL", "http://flightdeck:8080")
FLIGHTDECK_INGEST_KEY = os.getenv("FLIGHTDECK_INGEST_KEY", "")
_VALID_SEVERITY = {"low", "med", "high", "urgent"}


class BugReportBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    severity: str = "med"
    url: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


@router.post("")
async def submit_bug_report(body: BugReportBody):
    if not FLIGHTDECK_INGEST_KEY:
        raise HTTPException(status_code=503, detail="Bug reporting is not configured.")

    severity = body.severity if body.severity in _VALID_SEVERITY else "med"
    payload = {
        "site": "personal-site",
        "url": body.url or "",
        "message": body.message.strip(),
        "severity": severity,
        "meta": body.meta or {},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{FLIGHTDECK_URL.rstrip('/')}/api/ingest/bug",
                json=payload,
                headers={"X-API-Key": FLIGHTDECK_INGEST_KEY},
            )
    except httpx.RequestError as exc:
        logger.error("flightdeck ingest unreachable: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the bug tracker.")

    if resp.status_code >= 300:
        logger.error("flightdeck ingest failed: status=%s body=%s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Bug tracker rejected the report.")

    return {"ok": True}
