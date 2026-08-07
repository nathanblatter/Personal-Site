from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.cache import cache
from app.routers.about import _cert_response
from app.utils import sort_experience

router = APIRouter(prefix="/about-page", tags=["about-page"])

CACHE_KEY = "page:about"
CACHE_TTL = 300


@router.get("")
async def get_about_page_data(db: AsyncSession = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    about_r = await db.execute(select(models.About).where(models.About.id == 1))
    interests_r = await db.execute(select(models.Interest).order_by(models.Interest.sort_order))
    coursework_r = await db.execute(select(models.Coursework).order_by(models.Coursework.sort_order))
    experience_r = await db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    testimonials_r = await db.execute(select(models.Testimonial).order_by(models.Testimonial.sort_order))
    certs_r = await db.execute(
        select(models.Certification).order_by(models.Certification.sort_order, models.Certification.id)
    )
    photos_r = await db.execute(
        select(models.PersonalPhoto)
        .where(models.PersonalPhoto.context == "about")
        .order_by(models.PersonalPhoto.sort_order, models.PersonalPhoto.id)
    )

    data = {
        "about": schemas.AboutResponse.model_validate(about_r.scalar_one_or_none()).model_dump(),
        "interests": [schemas.InterestResponse.model_validate(i).model_dump() for i in interests_r.scalars().all()],
        "coursework": [schemas.CourseworkResponse.model_validate(c).model_dump() for c in coursework_r.scalars().all()],
        "experience": [schemas.ExperienceResponse.model_validate(e).model_dump() for e in sort_experience(experience_r.scalars().all())],
        "testimonials": [schemas.TestimonialResponse.model_validate(t).model_dump() for t in testimonials_r.scalars().all()],
        "certifications": [_cert_response(c).model_dump() for c in certs_r.scalars().unique().all()],
        "personal_photos": [schemas.PersonalPhotoResponse.model_validate(p).model_dump() for p in photos_r.scalars().all()],
    }
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return data
