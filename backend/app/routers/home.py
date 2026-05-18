import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/home", tags=["home"])


@router.get("")
async def get_home_data(db: AsyncSession = Depends(get_db)):
    projects_q = db.execute(select(models.Project).order_by(models.Project.sort_order))
    skills_q = db.execute(select(models.Skill).order_by(models.Skill.sort_order))
    experience_q = db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    about_q = db.execute(select(models.About).where(models.About.id == 1))

    projects_r, skills_r, experience_r, about_r = await asyncio.gather(
        projects_q, skills_q, experience_q, about_q
    )

    return {
        "projects": [schemas.ProjectResponse.model_validate(p) for p in projects_r.scalars().all()],
        "skills": [schemas.SkillResponse.model_validate(s) for s in skills_r.scalars().all()],
        "experience": [schemas.ExperienceResponse.model_validate(e) for e in experience_r.scalars().all()],
        "about": schemas.AboutResponse.model_validate(about_r.scalar_one_or_none()),
    }
