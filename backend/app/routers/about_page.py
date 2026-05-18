import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/about-page", tags=["about-page"])


@router.get("")
async def get_about_page_data(db: AsyncSession = Depends(get_db)):
    about_q = db.execute(select(models.About).where(models.About.id == 1))
    interests_q = db.execute(select(models.Interest).order_by(models.Interest.sort_order))
    coursework_q = db.execute(select(models.Coursework).order_by(models.Coursework.sort_order))
    experience_q = db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    testimonials_q = db.execute(select(models.Testimonial).order_by(models.Testimonial.sort_order))

    about_r, interests_r, coursework_r, experience_r, testimonials_r = await asyncio.gather(
        about_q, interests_q, coursework_q, experience_q, testimonials_q
    )

    return {
        "about": schemas.AboutResponse.model_validate(about_r.scalar_one_or_none()),
        "interests": [schemas.InterestResponse.model_validate(i) for i in interests_r.scalars().all()],
        "coursework": [schemas.CourseworkResponse.model_validate(c) for c in coursework_r.scalars().all()],
        "experience": [schemas.ExperienceResponse.model_validate(e) for e in experience_r.scalars().all()],
        "testimonials": [schemas.TestimonialResponse.model_validate(t) for t in testimonials_r.scalars().all()],
    }
