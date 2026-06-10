import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.utils import get_client_ip
from app import umami_service, imessage_service

router = APIRouter(tags=["links"])


async def _fire_umami_event(request: FastAPIRequest, link: models.TrackedLink):
    """Send a click event to Umami without blocking the response."""
    await umami_service.fire_event(
        request,
        url=f"/go/{link.slug}",
        event_name="link-click",
        event_data={"slug": link.slug, "label": link.label, "destination": link.destination_url},
    )


async def _send_visitor_alert(request: FastAPIRequest, link: models.TrackedLink):
    """Send an iMessage alert when someone clicks a tracked link."""
    ip = get_client_ip(request)

    ua = request.headers.get("user-agent", "")
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

    location = await imessage_service.geo_lookup(ip)

    msg = (
        f"Portfolio link clicked: /go/{link.slug}\n"
        f"Label: {link.label}\n"
        f"Click #{link.clicks} | {browser}{location}"
    )
    await imessage_service.send_alert(msg)


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
