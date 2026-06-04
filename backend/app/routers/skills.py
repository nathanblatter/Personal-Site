from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=List[schemas.SkillResponse])
async def list_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Skill).order_by(models.Skill.sort_order))
    return result.scalars().all()


@router.get("/{skill_id}", response_model=schemas.SkillResponse)
async def get_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Skill).where(models.Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.post("", response_model=schemas.SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(payload: schemas.SkillCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    skill = models.Skill(**payload.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    await cache.delete("page:home")
    return skill


@router.put("/{skill_id}", response_model=schemas.SkillResponse)
async def update_skill(
    skill_id: int, payload: schemas.SkillUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(select(models.Skill).where(models.Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(skill, key, value)
    await db.commit()
    await db.refresh(skill)
    await cache.delete("page:home")
    return skill


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Skill).where(models.Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()
    await cache.delete("page:home")
