from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.cache import cache

router = APIRouter(prefix="/home", tags=["home"])

CACHE_KEY = "page:home"
CACHE_TTL = 300  # 5 minutes


@router.get("")
async def get_home_data(db: AsyncSession = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    projects_r = await db.execute(select(models.Project).order_by(models.Project.sort_order))
    skills_r = await db.execute(select(models.Skill).order_by(models.Skill.sort_order))
    experience_r = await db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    about_r = await db.execute(select(models.About).where(models.About.id == 1))

    data = {
        "projects": [schemas.ProjectResponse.model_validate(p).model_dump() for p in projects_r.scalars().all()],
        "skills": [schemas.SkillResponse.model_validate(s).model_dump() for s in skills_r.scalars().all()],
        "experience": [schemas.ExperienceResponse.model_validate(e).model_dump() for e in experience_r.scalars().all()],
        "about": schemas.AboutResponse.model_validate(about_r.scalar_one_or_none()).model_dump(),
    }
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return data
