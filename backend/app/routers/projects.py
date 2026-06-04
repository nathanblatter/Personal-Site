from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[schemas.ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Project).order_by(models.Project.sort_order))
    return result.scalars().all()


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: schemas.ProjectCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    project = models.Project(**payload.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    await cache.delete("page:home")
    return project


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
async def update_project(
    project_id: int, payload: schemas.ProjectUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    await cache.delete("page:home")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    await cache.delete("page:home")
