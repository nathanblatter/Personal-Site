import asyncio
import json as _json
import os
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth

router = APIRouter(tags=["links"])

UMAMI_URL = os.getenv("UMAMI_URL", "http://docker-services-umami-1:3000")
WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "49f0edff-13f8-4a9b-9da6-5ad92bd18abc")

IMESSAGE_API_URL = os.getenv("IMESSAGE_API_URL", "http://100.79.61.79:8899")
IMESSAGE_API_KEY = os.getenv("IMESSAGE_API_KEY") or os.getenv("imessage_api_key", "")
ALERT_RECIPIENT = os.getenv("ALERT_PHONE", "9258869553")

_umami_client = httpx.AsyncClient(timeout=3.0)
_imessage_client = httpx.AsyncClient(timeout=5.0)


async def _fire_umami_event(request: FastAPIRequest, link: models.TrackedLink):
    """Send a click event to Umami without blocking the response."""
    ip = "127.0.0.1"
    for header in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        val = request.headers.get(header)
        if val:
            ip = val.split(",")[0].strip()
            break
    else:
        if request.client:
            ip = request.client.host

    headers = {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent", ""),
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
    }

    common = {
        "website": WEBSITE_ID,
        "url": f"/go/{link.slug}",
        "hostname": "nathanblatter.com",
        "language": request.headers.get("accept-language", "en").split(",")[0],
        "screen": "0x0",
    }

    payloads = [
        {"type": "event", "payload": {**common, "referrer": request.headers.get("referer", "")}},
        {"type": "event", "payload": {**common, "name": "link-click", "data": {"slug": link.slug, "label": link.label, "destination": link.destination_url}}},
    ]

    try:
        for body in payloads:
            await _umami_client.post(f"{UMAMI_URL}/api/send", json=body, headers=headers)
    except httpx.HTTPError:
        pass


async def _send_visitor_alert(request: FastAPIRequest, link: models.TrackedLink):
    """Send an iMessage alert when someone clicks a tracked link."""
    if not IMESSAGE_API_KEY:
        return

    ip = "unknown"
    for header in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        val = request.headers.get(header)
        if val:
            ip = val.split(",")[0].strip()
            break

    ua = request.headers.get("user-agent", "")
    # Shorten user-agent to just browser/OS
    browser = "Unknown"
    for name in ("Chrome", "Firefox", "Safari", "Edge", "Opera"):
        if name in ua:
            browser = name
            break
    if "iPhone" in ua or "iPad" in ua:
        browser += " (iOS)"
    elif "Android" in ua:
        browser += " (Android)"
    elif "Mac" in ua:
        browser += " (Mac)"
    elif "Windows" in ua:
        browser += " (Windows)"

    # Geo-lookup the IP
    location = ""
    try:
        geo = await _imessage_client.get(f"http://ip-api.com/json/{ip}?fields=city,regionName,country", timeout=3.0)
        if geo.status_code == 200:
            g = geo.json()
            parts = [p for p in (g.get("city"), g.get("regionName"), g.get("country")) if p]
            if parts:
                location = f" | {', '.join(parts)}"
    except httpx.HTTPError:
        pass

    msg = (
        f"Portfolio link clicked: /go/{link.slug}\n"
        f"Label: {link.label}\n"
        f"Click #{link.clicks} | {browser}{location}"
    )

    try:
        await _imessage_client.post(
            f"{IMESSAGE_API_URL}/send",
            json={"recipient": ALERT_RECIPIENT, "message": msg},
            headers={"X-API-Key": IMESSAGE_API_KEY, "Content-Type": "application/json"},
        )
    except httpx.HTTPError:
        pass


# ── Public redirect ──────────────────────────────────────────────────────────

@router.get("/go/{slug}")
async def redirect_link(slug: str, request: FastAPIRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.TrackedLink).where(models.TrackedLink.slug == slug))
    link = result.scalar_one_or_none()
    if not link:
        treq_result = await db.execute(
            select(models.TestimonialRequest).where(models.TestimonialRequest.slug == slug)
        )
        treq = treq_result.scalar_one_or_none()
        if treq and treq.status not in ("approved", "rejected"):
            return RedirectResponse(url=f"/testimonial/{treq.slug}", status_code=302)
        raise HTTPException(status_code=404, detail="Link not found")

    link.clicks += 1
    await db.commit()

    asyncio.create_task(_fire_umami_event(request, link))
    asyncio.create_task(_send_visitor_alert(request, link))

    if link.portfolio_ctx is not None:
        return RedirectResponse(url=f"/?ctx={link.slug}", status_code=302)
    return RedirectResponse(url=link.destination_url, status_code=302)


# ── Public ctx endpoint ───────────────────────────────────────────────────────

@router.get("/api/v1/links/ctx/{slug}", response_model=schemas.PortfolioCtx)
async def get_portfolio_ctx(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.TrackedLink).where(models.TrackedLink.slug == slug))
    link = result.scalar_one_or_none()
    if not link or link.portfolio_ctx is None:
        raise HTTPException(status_code=404, detail="No portfolio context")
    return link.portfolio_ctx


# ── Admin CRUD ───────────────────────────────────────────────────────────────

@router.get("/api/v1/links", response_model=List[schemas.TrackedLinkResponse])
async def list_links(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.TrackedLink).order_by(models.TrackedLink.id.desc()))
    return result.scalars().all()


@router.post("/api/v1/links", response_model=schemas.TrackedLinkResponse, status_code=201)
async def create_link(payload: schemas.TrackedLinkCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    link = models.TrackedLink(**payload.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.put("/api/v1/links/{link_id}", response_model=schemas.TrackedLinkResponse)
async def update_link(link_id: int, payload: schemas.TrackedLinkUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.TrackedLink).where(models.TrackedLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
    await db.commit()
    await db.refresh(link)
    return link


@router.delete("/api/v1/links/{link_id}", status_code=204)
async def delete_link(link_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.TrackedLink).where(models.TrackedLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    await db.commit()
