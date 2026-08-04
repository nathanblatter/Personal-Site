"""Bug report router — forwards visitor-submitted bugs to the flightdeck board.

The flightdeck ingest key lives only on the server (never in the client bundle);
the browser calls this same-origin endpoint and we forward to flightdeck over the
shared docker network.
"""

import logging
import os
import uuid
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger("portfolio.bug_report")

router = APIRouter(prefix="/bug-report", tags=["bug-report"])

FLIGHTDECK_URL = os.getenv("FLIGHTDECK_URL", "http://flightdeck:8080")
FLIGHTDECK_INGEST_KEY = os.getenv("FLIGHTDECK_INGEST_KEY", "")
_VALID_SEVERITY = {"low", "med", "high", "urgent"}

# Screenshot caps — mirror flightdeck's ingest limits so we fail fast here.
_MAX_SCREENSHOTS = 4
_MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024  # 8MB
_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


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

    item_id: Optional[str] = None
    try:
        item_id = resp.json().get("id")
    except ValueError:
        logger.warning("flightdeck ingest returned non-JSON body")
    return {"ok": True, "id": item_id}


@router.post("/{item_id}/screenshots", status_code=201)
async def upload_screenshots(item_id: str, files: list[UploadFile] = File(...)):
    """Forward bug-report screenshots to flightdeck's attachment ingest.

    Flightdeck enforces the same caps server-side (and sniffs the actual bytes,
    plus requires the item to be <15 minutes old); we pre-check here for
    friendlier errors and to avoid shipping oversized bodies across the network.
    """
    if not FLIGHTDECK_INGEST_KEY:
        raise HTTPException(status_code=503, detail="Bug reporting is not configured.")

    try:
        uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report id.")

    if not files:
        raise HTTPException(status_code=400, detail="No screenshots attached.")
    if len(files) > _MAX_SCREENSHOTS:
        raise HTTPException(status_code=400, detail=f"At most {_MAX_SCREENSHOTS} screenshots per report.")

    parts: list[tuple[str, tuple[str, bytes, str]]] = []
    for f in files:
        if f.content_type not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Screenshots must be PNG, JPEG, WebP, or GIF images.")
        data = await f.read()
        if len(data) > _MAX_SCREENSHOT_BYTES:
            raise HTTPException(status_code=400, detail="Each screenshot must be 8MB or smaller.")
        parts.append(("files", (f.filename or "screenshot.png", data, f.content_type)))

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{FLIGHTDECK_URL.rstrip('/')}/api/ingest/attachments/{item_id}",
                files=parts,
                headers={"X-API-Key": FLIGHTDECK_INGEST_KEY},
            )
    except httpx.RequestError as exc:
        logger.error("flightdeck attachment ingest unreachable: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the bug tracker.")

    if resp.status_code >= 300:
        logger.error(
            "flightdeck attachment ingest failed: status=%s body=%s", resp.status_code, resp.text
        )
        raise HTTPException(status_code=502, detail="Bug tracker rejected the screenshots.")

    return resp.json()
