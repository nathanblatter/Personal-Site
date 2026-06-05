import asyncio
import os
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models, schemas
from app.auth import require_auth

router = APIRouter(tags=["bio"])

UMAMI_URL = os.getenv("UMAMI_URL", "http://docker-services-umami-1:3000")
WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "49f0edff-13f8-4a9b-9da6-5ad92bd18abc")

_umami_client = httpx.AsyncClient(timeout=3.0)


async def _fire_umami_bio_event(request: FastAPIRequest, link: models.BioLink):
    """Send a bio link click event to Umami without blocking the response."""
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
        "url": "/linkinbio",
        "hostname": "nathanblatter.com",
        "language": request.headers.get("accept-language", "en").split(",")[0],
        "screen": "0x0",
    }

    payloads = [
        {"type": "event", "payload": {**common, "referrer": request.headers.get("referer", "")}},
        {"type": "event", "payload": {**common, "name": "bio-link-click", "data": {"title": link.title, "url": link.url, "category": link.category or ""}}},
    ]

    try:
        for body in payloads:
            await _umami_client.post(f"{UMAMI_URL}/api/send", json=body, headers=headers)
    except httpx.HTTPError:
        pass


# ── Public endpoints ─────────────────────────────────────────────────────────

@router.get("/bio", response_model=schemas.BioPagePublicResponse)
async def get_bio_page(db: AsyncSession = Depends(get_db)):
    """Public bio page: settings + enabled links + socials."""
    # Settings (get-or-create with id=1)
    result = await db.execute(select(models.BioPageSettings).where(models.BioPageSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = models.BioPageSettings(id=1)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    # Enabled links sorted by sort_order
    result = await db.execute(
        select(models.BioLink)
        .where(models.BioLink.enabled == True)  # noqa: E712
        .order_by(models.BioLink.sort_order)
    )
    links = result.scalars().all()

    # Socials
    result = await db.execute(select(models.Social).order_by(models.Social.sort_order))
    socials = result.scalars().all()

    return schemas.BioPagePublicResponse(
        settings=settings,
        links=links,
        socials=socials,
    )


@router.post("/bio/click/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def bio_link_click(link_id: int, request: FastAPIRequest, db: AsyncSession = Depends(get_db)):
    """Increment click count and fire Umami event."""
    result = await db.execute(select(models.BioLink).where(models.BioLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Bio link not found")

    link.clicks += 1
    await db.commit()

    asyncio.create_task(_fire_umami_bio_event(request, link))


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/bio/links", response_model=List[schemas.BioLinkResponse])
async def list_bio_links(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    """List all bio links (including disabled)."""
    result = await db.execute(select(models.BioLink).order_by(models.BioLink.sort_order))
    return result.scalars().all()


@router.post("/bio/links", response_model=schemas.BioLinkResponse, status_code=201)
async def create_bio_link(payload: schemas.BioLinkCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    link = models.BioLink(**payload.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.put("/bio/links/{link_id}", response_model=schemas.BioLinkResponse)
async def update_bio_link(link_id: int, payload: schemas.BioLinkUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.BioLink).where(models.BioLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Bio link not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
    await db.commit()
    await db.refresh(link)
    return link


@router.delete("/bio/links/{link_id}", status_code=204)
async def delete_bio_link(link_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.BioLink).where(models.BioLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Bio link not found")
    await db.delete(link)
    await db.commit()


@router.get("/bio/settings", response_model=schemas.BioPageSettingsResponse)
async def get_bio_settings(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.BioPageSettings).where(models.BioPageSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = models.BioPageSettings(id=1)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.put("/bio/settings", response_model=schemas.BioPageSettingsResponse)
async def update_bio_settings(payload: schemas.BioPageSettingsUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.BioPageSettings).where(models.BioPageSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = models.BioPageSettings(id=1)
        db.add(settings)
        await db.flush()
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return settings
