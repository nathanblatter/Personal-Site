from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/personal-photos", tags=["personal-photos"])


@router.get("", response_model=List[schemas.PersonalPhotoResponse])
async def list_personal_photos(
    context: Optional[str] = Query(None, description='Filter by context ("about" | "now")'),
    db: AsyncSession = Depends(get_db),
):
    query = select(models.PersonalPhoto).order_by(
        models.PersonalPhoto.sort_order, models.PersonalPhoto.id
    )
    if context is not None:
        query = query.where(models.PersonalPhoto.context == context)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=schemas.PersonalPhotoResponse, status_code=status.HTTP_201_CREATED)
async def create_personal_photo(
    payload: schemas.PersonalPhotoCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    photo = models.PersonalPhoto(**payload.model_dump())
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    await cache.delete("page:about")
    return photo


@router.put("/{photo_id}", response_model=schemas.PersonalPhotoResponse)
async def update_personal_photo(
    photo_id: int, payload: schemas.PersonalPhotoUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.PersonalPhoto).where(models.PersonalPhoto.id == photo_id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Personal photo not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(photo, key, value)
    await db.commit()
    await db.refresh(photo)
    await cache.delete("page:about")
    return photo


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_personal_photo(
    photo_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.PersonalPhoto).where(models.PersonalPhoto.id == photo_id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Personal photo not found")
    await db.delete(photo)
    await db.commit()
    await cache.delete("page:about")
