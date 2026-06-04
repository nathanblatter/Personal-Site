from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.cache import cache

router = APIRouter(prefix="/contact-page", tags=["contact-page"])

CACHE_KEY = "page:contact"
CACHE_TTL = 300


@router.get("")
async def get_contact_page_data(db: AsyncSession = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    meta_r = await db.execute(select(models.ContactMeta).where(models.ContactMeta.id == 1))
    socials_r = await db.execute(select(models.Social).order_by(models.Social.sort_order))

    data = {
        "meta": schemas.ContactMetaResponse.model_validate(meta_r.scalar_one_or_none()).model_dump(),
        "socials": [schemas.SocialResponse.model_validate(s).model_dump() for s in socials_r.scalars().all()],
    }
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return data
