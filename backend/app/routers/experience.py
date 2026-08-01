from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache
from app.utils import sort_experience

router = APIRouter(prefix="/experience", tags=["experience"])


@router.get("", response_model=List[schemas.ExperienceResponse])
async def list_experience(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    return sort_experience(result.scalars().all())


@router.get("/{experience_id}", response_model=schemas.ExperienceResponse)
async def get_experience(experience_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Experience).where(models.Experience.id == experience_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    return exp


@router.post("", response_model=schemas.ExperienceResponse, status_code=status.HTTP_201_CREATED)
async def create_experience(payload: schemas.ExperienceCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    exp = models.Experience(**payload.model_dump())
    db.add(exp)
    await db.commit()
    await db.refresh(exp)
    await cache.delete("page:home")
    await cache.delete("page:about")
    return exp


@router.put("/{experience_id}", response_model=schemas.ExperienceResponse)
async def update_experience(
    experience_id: int, payload: schemas.ExperienceUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.Experience).where(models.Experience.id == experience_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(exp, key, value)
    await db.commit()
    await db.refresh(exp)
    await cache.delete("page:home")
    await cache.delete("page:about")
    return exp


@router.delete("/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_experience(experience_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Experience).where(models.Experience.id == experience_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    await db.delete(exp)
    await db.commit()
    await cache.delete("page:home")
    await cache.delete("page:about")
