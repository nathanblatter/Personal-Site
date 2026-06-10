import httpx
from fastapi import APIRouter, Request as FastAPIRequest, Query
from fastapi.responses import Response

from app.umami_service import UMAMI_URL, WEBSITE_ID, client as _client, proxy_headers as _proxy_headers
from app.utils import get_client_ip

router = APIRouter(prefix="/a", tags=["analytics"])

# 1x1 transparent GIF
PIXEL = b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"


@router.get("/script.js")
async def umami_script():
    try:
        resp = await _client.get(f"{UMAMI_URL}/script.js")
        return Response(content=resp.content, media_type="application/javascript", headers={"Cache-Control": "public, max-age=86400"})
    except httpx.HTTPError:
        return Response(content="", media_type="application/javascript", status_code=204)


@router.post("/api/send")
async def umami_collect(request: FastAPIRequest):
    body = await request.body()
    try:
        resp = await _client.post(
            f"{UMAMI_URL}/api/send",
            content=body,
            headers=_proxy_headers(request),
        )
        return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
    except httpx.HTTPError:
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
    payload = {
        "type": "event",
        "payload": {
            "website": WEBSITE_ID,
            "url": url,
            "hostname": "nathanblatter.com",
            "language": request.headers.get("accept-language", "en").split(",")[0],
            "screen": "0x0",
            "title": t or "pixel",
        },
    }

    try:
        await _client.post(
            f"{UMAMI_URL}/api/send",
            json=payload,
            headers=_proxy_headers(request),
        )
    except httpx.HTTPError:
        pass

    return Response(
        content=PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
    )


async def _proxy_umami(path: str, request: FastAPIRequest) -> Response:
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
        resp = await _client.get(url, headers=headers)
        ct = resp.headers.get("content-type", "text/html")
        cache = resp.headers.get("cache-control", "")
        h = {}
        if cache:
            h["Cache-Control"] = cache
        return Response(content=resp.content, media_type=ct, status_code=resp.status_code, headers=h)
    except httpx.HTTPError:
        return Response(content="Not found", status_code=502)


@router.get("/share/{path:path}")
async def umami_share(path: str, request: FastAPIRequest):
    return await _proxy_umami(f"share/{path}", request)


@router.get("/_next/{path:path}")
async def umami_next_assets(path: str, request: FastAPIRequest):
    return await _proxy_umami(f"_next/{path}", request)


@router.get("/api/{path:path}")
async def umami_api_get(path: str, request: FastAPIRequest):
    return await _proxy_umami(f"api/{path}?{request.url.query}", request)
