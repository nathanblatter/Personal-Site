import os
import time
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel

router = APIRouter(tags=["status"])

_dev_status: dict = {"last_ping": None, "active": False, "type": "none"}
STALE_AFTER = 120  # seconds


def _verify_dev_status_key(x_api_key: Optional[str] = Header(None)) -> None:
    if x_api_key != os.getenv("DEV_STATUS_API_KEY"):
        raise HTTPException(status_code=401, detail="Unauthorized")


class DevStatusPayload(BaseModel):
    active: bool
    type: str  # "ssh" | "vnc" | "both" | "none"


@router.post("/dev", status_code=204)
def update_dev_status(
    payload: DevStatusPayload,
    _: None = Header(None, alias="x-api-key"),
    x_api_key: Optional[str] = Header(None),
):
    _verify_dev_status_key(x_api_key)
    _dev_status["last_ping"] = time.monotonic()
    _dev_status["active"] = payload.active
    _dev_status["type"] = payload.type
    return Response(status_code=204)


@router.get("")
def get_status():
    last = _dev_status["last_ping"]
    stale = last is None or (time.monotonic() - last) > STALE_AFTER
    return {
        "dev_active": False if stale else _dev_status["active"],
        "dev_type": _dev_status["type"],
        "stale": stale,
    }
