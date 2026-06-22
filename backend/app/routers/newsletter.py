import re
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.utils import get_client_ip, get_redis

router = APIRouter(prefix="/newsletter", tags=["newsletter"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

IP_LIMIT = 5
IP_WINDOW = 15 * 60  # 15 minutes in seconds


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(payload: schemas.SubscribeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Honeypot — bots fill hidden fields, humans don't
    if payload.honeypot:
        return  # silent 204, don't reveal detection

    email = payload.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    # IP rate limit
    redis = get_redis()
    ip_key = f"newsletter:ip:{get_client_ip(request)}"
    ip_count = await redis.incr(ip_key)
    if ip_count == 1:
        await redis.expire(ip_key, IP_WINDOW)
    if ip_count > IP_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

    existing = await db.execute(select(models.Subscriber).where(models.Subscriber.email == email))
    sub = existing.scalar_one_or_none()
    if sub:
        # Idempotent: re-subscribing simply clears an unsubscribe flag.
        if sub.unsubscribed:
            sub.unsubscribed = False
            await db.commit()
        return

    db.add(models.Subscriber(email=email, source="blog", created_at=_now()))
    await db.commit()


@router.get("", response_model=List[schemas.SubscriberResponse])
async def list_subscribers(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Subscriber).order_by(models.Subscriber.created_at.desc())
    )
    return result.scalars().all()
