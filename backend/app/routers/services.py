"""Public /services ("Work With Me") page + admin CRUD.

Content types (all DB-backed, no hardcoded content in the frontend):
- ServicesMeta      — singleton editorial copy (heading/intro/CTA)
- ServiceOffering   — "what I do" cards
- ServiceProcessStep— "how we'll work" steps
- EngagementTier    — pricing tiers with rough pricing + feature lists

The assembled public payload is cached in Redis under ``page:services`` (TTL
300s) and busted on every admin write.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/services", tags=["services"])

CACHE_KEY = "page:services"
CACHE_TTL = 300
SINGLETON_ID = 1


async def _bust() -> None:
    await cache.delete(CACHE_KEY)


# ── Public aggregate ────────────────────────────────────────────────────────────

@router.get("/page", response_model=schemas.ServicesPageResponse)
async def get_services_page(db: AsyncSession = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    meta_r = await db.execute(select(models.ServicesMeta).where(models.ServicesMeta.id == SINGLETON_ID))
    offerings_r = await db.execute(select(models.ServiceOffering).order_by(models.ServiceOffering.sort_order, models.ServiceOffering.id))
    process_r = await db.execute(select(models.ServiceProcessStep).order_by(models.ServiceProcessStep.sort_order, models.ServiceProcessStep.id))
    tiers_r = await db.execute(select(models.EngagementTier).order_by(models.EngagementTier.sort_order, models.EngagementTier.id))
    testimonials_r = await db.execute(select(models.Testimonial).order_by(models.Testimonial.sort_order))

    meta = meta_r.scalar_one_or_none()
    data = {
        "meta": schemas.ServicesMetaResponse.model_validate(meta).model_dump() if meta else None,
        "offerings": [schemas.ServiceOfferingResponse.model_validate(o).model_dump() for o in offerings_r.scalars().all()],
        "process": [schemas.ServiceProcessStepResponse.model_validate(p).model_dump() for p in process_r.scalars().all()],
        "tiers": [schemas.EngagementTierResponse.model_validate(t).model_dump() for t in tiers_r.scalars().all()],
        "testimonials": [schemas.TestimonialResponse.model_validate(t).model_dump() for t in testimonials_r.scalars().all()],
    }
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return data


# ── Meta (singleton) ─────────────────────────────────────────────────────────────

@router.get("/meta", response_model=schemas.ServicesMetaResponse)
async def get_meta(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ServicesMeta).where(models.ServicesMeta.id == SINGLETON_ID))
    meta = result.scalar_one_or_none()
    if not meta:
        raise HTTPException(status_code=404, detail="Services meta not found")
    return meta


@router.put("/meta", response_model=schemas.ServicesMetaResponse)
async def upsert_meta(payload: schemas.ServicesMetaUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.ServicesMeta).where(models.ServicesMeta.id == SINGLETON_ID))
    meta = result.scalar_one_or_none()
    if meta is None:
        meta = models.ServicesMeta(id=SINGLETON_ID, heading="", subheading="")
        db.add(meta)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(meta, key, value)
    await db.commit()
    await db.refresh(meta)
    await _bust()
    return meta


# ── Offerings ────────────────────────────────────────────────────────────────────

@router.get("/offerings", response_model=List[schemas.ServiceOfferingResponse])
async def list_offerings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ServiceOffering).order_by(models.ServiceOffering.sort_order, models.ServiceOffering.id))
    return result.scalars().all()


@router.post("/offerings", response_model=schemas.ServiceOfferingResponse, status_code=status.HTTP_201_CREATED)
async def create_offering(payload: schemas.ServiceOfferingCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    obj = models.ServiceOffering(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.put("/offerings/{oid}", response_model=schemas.ServiceOfferingResponse)
async def update_offering(oid: int, payload: schemas.ServiceOfferingUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.ServiceOffering).where(models.ServiceOffering.id == oid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Offering not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.delete("/offerings/{oid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_offering(oid: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.ServiceOffering).where(models.ServiceOffering.id == oid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Offering not found")
    await db.delete(obj)
    await db.commit()
    await _bust()


# ── Process steps ─────────────────────────────────────────────────────────────────

@router.get("/process", response_model=List[schemas.ServiceProcessStepResponse])
async def list_process(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ServiceProcessStep).order_by(models.ServiceProcessStep.sort_order, models.ServiceProcessStep.id))
    return result.scalars().all()


@router.post("/process", response_model=schemas.ServiceProcessStepResponse, status_code=status.HTTP_201_CREATED)
async def create_process(payload: schemas.ServiceProcessStepCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    obj = models.ServiceProcessStep(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.put("/process/{pid}", response_model=schemas.ServiceProcessStepResponse)
async def update_process(pid: int, payload: schemas.ServiceProcessStepUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.ServiceProcessStep).where(models.ServiceProcessStep.id == pid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Process step not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.delete("/process/{pid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_process(pid: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.ServiceProcessStep).where(models.ServiceProcessStep.id == pid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Process step not found")
    await db.delete(obj)
    await db.commit()
    await _bust()


# ── Engagement tiers ──────────────────────────────────────────────────────────────

@router.get("/tiers", response_model=List[schemas.EngagementTierResponse])
async def list_tiers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.EngagementTier).order_by(models.EngagementTier.sort_order, models.EngagementTier.id))
    return result.scalars().all()


@router.post("/tiers", response_model=schemas.EngagementTierResponse, status_code=status.HTTP_201_CREATED)
async def create_tier(payload: schemas.EngagementTierCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    obj = models.EngagementTier(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.put("/tiers/{tid}", response_model=schemas.EngagementTierResponse)
async def update_tier(tid: int, payload: schemas.EngagementTierUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.EngagementTier).where(models.EngagementTier.id == tid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Tier not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    await _bust()
    return obj


@router.delete("/tiers/{tid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier(tid: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.EngagementTier).where(models.EngagementTier.id == tid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Tier not found")
    await db.delete(obj)
    await db.commit()
    await _bust()
