import logging
import os
import aiosmtplib
from datetime import date
from email.message import EmailMessage
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas, crm_utils
from app.auth import require_auth
from app.cache import cache as app_cache
from app.utils import get_client_ip, get_redis

log = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
CONTACT_TO_EMAIL = os.getenv("CONTACT_TO_EMAIL", "nzb22@byu.edu")

DAILY_LIMIT = 100
IP_LIMIT = 3
IP_WINDOW = 15 * 60  # 15 minutes in seconds

SINGLETON_ID = 1


# ── Contact form submission ───────────────────────────────────────────────────

@router.post("/submit", status_code=status.HTTP_204_NO_CONTENT)
async def submit_contact(payload: schemas.ContactSubmit, request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Honeypot — bots fill hidden fields, humans don't
    if payload.honeypot:
        return  # silent 204, don't reveal detection

    redis = get_redis()

    # 2. IP rate limit: 3 submissions per 15 minutes
    ip = get_client_ip(request)
    ip_key = f"contact:ip:{ip}"
    ip_count = await redis.incr(ip_key)
    if ip_count == 1:
        await redis.expire(ip_key, IP_WINDOW)
    if ip_count > IP_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages. Try again later.")

    # 3. Daily global cap: 100 emails per day
    daily_key = f"contact:daily:{date.today().isoformat()}"
    daily_count = await redis.incr(daily_key)
    if daily_count == 1:
        await redis.expire(daily_key, 86400)
    if daily_count > DAILY_LIMIT:
        raise HTTPException(status_code=503, detail="Daily message limit reached. Try again tomorrow.")

    msg = EmailMessage()
    msg["From"] = "noreply@nathanblatter.com"
    msg["To"] = CONTACT_TO_EMAIL
    msg["Reply-To"] = payload.email
    msg["Subject"] = f"New contact from {payload.name} — nathanblatter.com"
    msg.set_content(
        f"Name: {payload.name}\nEmail: {payload.email}\n\n{payload.message}"
    )
    try:
        await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False, timeout=10)
    except Exception:
        log.warning("Contact email send failed; persisting lead anyway", exc_info=True)

    # Persist as a CRM contact + timeline activity (de-duplicated by email).
    try:
        contact = await crm_utils.upsert_contact_by_email(
            db, email=payload.email, name=payload.name, source=models.ContactSource.contact_form,
        )
        await crm_utils.log_activity(
            db, contact_id=contact.id, type=models.ActivityType.contact_form, body_md=payload.message,
        )
        await db.commit()
    except Exception:
        await db.rollback()


# ── Contact meta singleton ────────────────────────────────────────────────────

@router.get("", response_model=schemas.ContactMetaResponse)
async def get_contact_meta(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ContactMeta).where(models.ContactMeta.id == SINGLETON_ID)
    )
    meta = result.scalar_one_or_none()
    if not meta:
        raise HTTPException(status_code=404, detail="Contact meta not found")
    return meta


@router.put("", response_model=schemas.ContactMetaResponse)
async def upsert_contact_meta(
    payload: schemas.ContactMetaUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.ContactMeta).where(models.ContactMeta.id == SINGLETON_ID)
    )
    meta = result.scalar_one_or_none()

    if meta is None:
        meta = models.ContactMeta(id=SINGLETON_ID)
        db.add(meta)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(meta, key, value)

    await db.commit()
    await db.refresh(meta)
    await app_cache.delete("page:contact")
    return meta


# ── Socials ───────────────────────────────────────────────────────────────────

@router.get("/socials", response_model=List[schemas.SocialResponse])
async def list_socials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Social).order_by(models.Social.sort_order))
    return result.scalars().all()


@router.get("/socials/{social_id}", response_model=schemas.SocialResponse)
async def get_social(social_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Social).where(models.Social.id == social_id))
    social = result.scalar_one_or_none()
    if not social:
        raise HTTPException(status_code=404, detail="Social not found")
    return social


@router.post(
    "/socials", response_model=schemas.SocialResponse, status_code=status.HTTP_201_CREATED
)
async def create_social(payload: schemas.SocialCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    social = models.Social(**payload.model_dump())
    db.add(social)
    await db.commit()
    await db.refresh(social)
    await app_cache.delete("page:contact")
    return social


@router.put("/socials/{social_id}", response_model=schemas.SocialResponse)
async def update_social(
    social_id: int, payload: schemas.SocialUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(select(models.Social).where(models.Social.id == social_id))
    social = result.scalar_one_or_none()
    if not social:
        raise HTTPException(status_code=404, detail="Social not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(social, key, value)
    await db.commit()
    await db.refresh(social)
    await app_cache.delete("page:contact")
    return social


@router.delete("/socials/{social_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_social(social_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Social).where(models.Social.id == social_id))
    social = result.scalar_one_or_none()
    if not social:
        raise HTTPException(status_code=404, detail="Social not found")
    await db.delete(social)
    await db.commit()
    await app_cache.delete("page:contact")
