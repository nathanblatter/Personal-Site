from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/site-content", tags=["site-content"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/{key}", response_model=schemas.SiteContentResponse)
async def get_content(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SiteContent).where(models.SiteContent.key == key))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Content not found")
    return row


@router.put("/{key}", response_model=schemas.SiteContentResponse)
async def upsert_content(
    key: str,
    payload: schemas.SiteContentUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(models.SiteContent).where(models.SiteContent.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        row = models.SiteContent(key=key)
        db.add(row)
    row.data = payload.data
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    # Aggregate pages assembled from site-content bust their cache on edit.
    if key == "privacy":
        await cache.delete("page:privacy")
    return row
