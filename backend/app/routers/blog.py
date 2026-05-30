from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth

router = APIRouter(prefix="/blog", tags=["blog"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=List[schemas.BlogPostResponse])
async def list_published_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.BlogPost)
        .where(models.BlogPost.published == True)  # noqa: E712
        .order_by(models.BlogPost.published_at.desc())
    )
    return result.scalars().all()


@router.get("/admin", response_model=List[schemas.BlogPostResponse])
async def list_all_posts(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.BlogPost).order_by(models.BlogPost.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=schemas.BlogPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: schemas.BlogPostCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    now = _now()
    post = models.BlogPost(
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
        published_at=now if payload.published else None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.put("/{post_id}", response_model=schemas.BlogPostResponse)
async def update_post(
    post_id: int,
    payload: schemas.BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(models.BlogPost).where(models.BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    data = payload.model_dump(exclude_unset=True)
    if data.get("published") and not post.published:
        data["published_at"] = _now()

    for key, value in data.items():
        setattr(post, key, value)
    post.updated_at = _now()

    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(models.BlogPost).where(models.BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.commit()


@router.get("/{slug}", response_model=schemas.BlogPostResponse)
async def get_post_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.BlogPost).where(models.BlogPost.slug == slug)
    )
    post = result.scalar_one_or_none()
    if not post or not post.published:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/{slug}/view", status_code=status.HTTP_204_NO_CONTENT)
async def increment_view(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.BlogPost).where(models.BlogPost.slug == slug)
    )
    post = result.scalar_one_or_none()
    if not post or not post.published:
        raise HTTPException(status_code=404, detail="Post not found")
    post.view_count = (post.view_count or 0) + 1
    await db.commit()
