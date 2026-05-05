import os
import json as _json
import mimetypes
from urllib.request import urlopen, Request
from urllib.error import URLError
from fastapi import APIRouter, Request as FastAPIRequest, Query
from fastapi.responses import Response

router = APIRouter(prefix="/a", tags=["analytics"])

UMAMI_URL = os.getenv("UMAMI_URL", "http://docker-services-umami-1:3000")
WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "49f0edff-13f8-4a9b-9da6-5ad92bd18abc")

# 1x1 transparent GIF
PIXEL = b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"


def _client_ip(request: FastAPIRequest) -> str:
    """Extract real client IP from proxy headers."""
    for header in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        val = request.headers.get(header)
        if val:
            return val.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _proxy_headers(request: FastAPIRequest) -> dict:
    ip = _client_ip(request)
    return {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent", ""),
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
    }


@router.get("/script.js")
def umami_script():
    try:
        with urlopen(f"{UMAMI_URL}/script.js", timeout=5) as resp:
            body = resp.read()
            return Response(content=body, media_type="application/javascript", headers={"Cache-Control": "public, max-age=86400"})
    except URLError:
        return Response(content="", media_type="application/javascript", status_code=204)


@router.post("/api/send")
async def umami_collect(request: FastAPIRequest):
    body = await request.body()
    try:
        req = Request(
            f"{UMAMI_URL}/api/send",
            data=body,
            headers=_proxy_headers(request),
            method="POST",
        )
        with urlopen(req, timeout=5) as resp:
            return Response(content=resp.read(), status_code=resp.status, media_type="application/json")
    except URLError:
        return Response(content="{}", media_type="application/json", status_code=204)


@router.get("/pixel.gif")
async def tracking_pixel(
    request: FastAPIRequest,
    t: str = Query("", description="Event title / name"),
    url: str = Query("/pixel", description="Page URL to attribute"),
):
    """1x1 tracking pixel. Use in emails, docs, etc.
    Example: <img src="https://nathanblatter.com/a/pixel.gif?t=resume-view&url=/resume" />
    """
    payload = _json.dumps({
        "type": "event",
        "payload": {
            "website": WEBSITE_ID,
            "url": url,
            "hostname": "nathanblatter.com",
            "language": request.headers.get("accept-language", "en").split(",")[0],
            "screen": "0x0",
            "title": t or "pixel",
        },
    }).encode()

    try:
        req = Request(
            f"{UMAMI_URL}/api/send",
            data=payload,
            headers=_proxy_headers(request),
            method="POST",
        )
        urlopen(req, timeout=5)
    except URLError:
        pass

    return Response(
        content=PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
    )


def _proxy_umami(path: str, request: FastAPIRequest) -> Response:
    """Generic reverse proxy to Umami."""
    url = f"{UMAMI_URL}/{path}"
    headers = {"User-Agent": request.headers.get("user-agent", "")}
    accept = request.headers.get("accept", "")
    if accept:
        headers["Accept"] = accept
    rsc = request.headers.get("rsc")
    if rsc:
        headers["rsc"] = rsc
    nrst = request.headers.get("next-router-state-tree")
    if nrst:
        headers["next-router-state-tree"] = nrst
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=10) as resp:
            body = resp.read()
            ct = resp.headers.get("Content-Type", "text/html")
            cache = resp.headers.get("Cache-Control", "")
            h = {}
            if cache:
                h["Cache-Control"] = cache
            return Response(content=body, media_type=ct, status_code=resp.status, headers=h)
    except URLError:
        return Response(content="Not found", status_code=502)


@router.get("/share/{path:path}")
async def umami_share(path: str, request: FastAPIRequest):
    return _proxy_umami(f"share/{path}", request)


@router.get("/_next/{path:path}")
async def umami_next_assets(path: str, request: FastAPIRequest):
    return _proxy_umami(f"_next/{path}", request)


@router.get("/api/{path:path}")
async def umami_api_get(path: str, request: FastAPIRequest):
    return _proxy_umami(f"api/{path}?{request.url.query}", request)
