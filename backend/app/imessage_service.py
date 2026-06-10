import logging
import os

import httpx

log = logging.getLogger(__name__)

IMESSAGE_API_URL = os.getenv("IMESSAGE_API_URL", "http://100.79.61.79:8899")
IMESSAGE_API_KEY = os.getenv("IMESSAGE_API_KEY") or os.getenv("imessage_api_key", "")
ALERT_RECIPIENT = os.getenv("NATHAN_PHONE", "")

_client = httpx.AsyncClient(timeout=5.0)


async def send_alert(message: str) -> None:
    """Send an iMessage alert to the configured recipient."""
    if not IMESSAGE_API_KEY or not ALERT_RECIPIENT:
        return
    try:
        await _client.post(
            f"{IMESSAGE_API_URL}/send",
            json={"recipient": ALERT_RECIPIENT, "message": message},
            headers={"X-API-Key": IMESSAGE_API_KEY, "Content-Type": "application/json"},
        )
    except httpx.HTTPError:
        log.warning("iMessage alert failed")


async def geo_lookup(ip: str) -> str:
    """Look up location from IP, returns empty string on failure."""
    try:
        geo = await _client.get(f"http://ip-api.com/json/{ip}?fields=city,regionName,country", timeout=3.0)
        if geo.status_code == 200:
            g = geo.json()
            parts = [p for p in (g.get("city"), g.get("regionName"), g.get("country")) if p]
            if parts:
                return f" | {', '.join(parts)}"
    except httpx.HTTPError:
        pass
    return ""
