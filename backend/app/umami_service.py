import os

import httpx
from fastapi import Request

from app.utils import get_client_ip

UMAMI_URL = os.getenv("UMAMI_URL", "http://docker-services-umami-1:3000")
WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "49f0edff-13f8-4a9b-9da6-5ad92bd18abc")

client = httpx.AsyncClient(timeout=10.0)


def proxy_headers(request: Request) -> dict:
    """Build headers for proxying requests to Umami."""
    ip = get_client_ip(request)
    return {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent", ""),
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
    }


async def fire_event(
    request: Request,
    url: str,
    event_name: str,
    event_data: dict | None = None,
):
    """Send a custom event to Umami without blocking the caller."""
    common = {
        "website": WEBSITE_ID,
        "url": url,
        "hostname": "nathanblatter.com",
        "language": request.headers.get("accept-language", "en").split(",")[0],
        "screen": "0x0",
    }

    payloads = [
        {"type": "event", "payload": {**common, "referrer": request.headers.get("referer", "")}},
        {"type": "event", "payload": {**common, "name": event_name, **({"data": event_data} if event_data else {})}},
    ]

    try:
        for body in payloads:
            await client.post(f"{UMAMI_URL}/api/send", json=body, headers=proxy_headers(request))
    except httpx.HTTPError:
        pass
