import json as _json
import os
from typing import List
from urllib.request import urlopen, Request
from urllib.error import URLError
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


def _fire_umami_event(request: FastAPIRequest, link: models.TrackedLink):
    """Send a click event to Umami in the background."""
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

    # Send pageview (shows in Pages tab under /go/slug)
    pv = _json.dumps({
        "type": "event",
        "payload": {
            "website": WEBSITE_ID,
            "url": f"/go/{link.slug}",
            "hostname": "nathanblatter.com",
            "language": request.headers.get("accept-language", "en").split(",")[0],
            "screen": "0x0",
            "referrer": request.headers.get("referer", ""),
        },
    }).encode()

    # Send named event (shows in Events tab as "link-click")
    ev = _json.dumps({
        "type": "event",
        "payload": {
            "website": WEBSITE_ID,
            "url": f"/go/{link.slug}",
            "hostname": "nathanblatter.com",
            "language": request.headers.get("accept-language", "en").split(",")[0],
            "screen": "0x0",
            "name": "link-click",
            "data": {"slug": link.slug, "label": link.label, "destination": link.destination_url},
        },
    }).encode()

    try:
        for body in (pv, ev):
            req = Request(f"{UMAMI_URL}/api/send", data=body, headers=headers, method="POST")
            urlopen(req, timeout=3)
    except URLError:
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

    _fire_umami_event(request, link)

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
