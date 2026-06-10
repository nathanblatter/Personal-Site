import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app import umami_service

router = APIRouter(tags=["bio"])


async def _fire_umami_bio_event(request: FastAPIRequest, link: models.BioLink):
    """Send a bio link click event to Umami without blocking the response."""
    await umami_service.fire_event(
        request,
        url="/linkinbio",
        event_name="bio-link-click",
        event_data={"title": link.title, "url": link.url, "category": link.category or ""},
    )


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
