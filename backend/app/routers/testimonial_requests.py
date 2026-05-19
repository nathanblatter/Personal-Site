from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.email_service import send_testimonial_request_email

router = APIRouter(tags=["testimonial-requests"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("/api/v1/testimonial/{slug}", response_model=schemas.TestimonialRequestPublic)
async def get_request_public(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.slug == slug)
    )
    req = result.scalar_one_or_none()
    if not req or req.status in ("approved", "rejected"):
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/api/v1/testimonial/{slug}/submit")
async def submit_testimonial(slug: str, payload: schemas.TestimonialSubmit, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.slug == slug)
    )
    req = result.scalar_one_or_none()
    if not req or req.status in ("approved", "rejected"):
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status == "submitted":
        raise HTTPException(status_code=409, detail="Already submitted")

    req.submitted_name = payload.name
    req.submitted_role = payload.role
    req.submitted_quote = payload.quote
    req.submitted_avatar_url = payload.avatar_url
    req.status = "submitted"
    req.submitted_at = _now()
    await db.commit()
    return {"ok": True}


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("/api/v1/testimonial-requests", response_model=List[schemas.TestimonialRequestResponse])
async def list_requests(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        select(models.TestimonialRequest).order_by(models.TestimonialRequest.id.desc())
    )
    return result.scalars().all()


@router.post("/api/v1/testimonial-requests", response_model=schemas.TestimonialRequestResponse, status_code=201)
async def create_request(payload: schemas.TestimonialRequestCreate, db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    # Check slug not taken by tracked link or another request
    existing = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already in use")

    req = models.TestimonialRequest(**payload.model_dump(), status="pending", created_at=_now())
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/api/v1/testimonial-requests/{req_id}/send-email")
async def send_email_endpoint(req_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    if not req.requester_email:
        raise HTTPException(status_code=400, detail="No email address on this request")
    if req.status in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Request already closed")

    ok = await send_testimonial_request_email(req)
    if ok and req.status == "pending":
        req.status = "sent"
        await db.commit()
    return {"ok": ok}


@router.post("/api/v1/testimonial-requests/{req_id}/approve", response_model=schemas.TestimonialRequestResponse)
async def approve_request(req_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req or req.status != "submitted":
        raise HTTPException(status_code=400, detail="Request not found or not in submitted state")

    # Count existing testimonials for sort_order
    count_result = await db.execute(select(models.Testimonial))
    sort_order = len(count_result.scalars().all())

    testimonial = models.Testimonial(
        name=req.submitted_name,
        role=req.submitted_role,
        quote=req.submitted_quote,
        avatar_url=req.submitted_avatar_url,
        sort_order=sort_order,
    )
    db.add(testimonial)
    await db.flush()

    req.status = "approved"
    req.reviewed_at = _now()
    req.testimonial_id = testimonial.id
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/api/v1/testimonial-requests/{req_id}/reject", response_model=schemas.TestimonialRequestResponse)
async def reject_request(req_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404)
    req.status = "rejected"
    req.reviewed_at = _now()
    await db.commit()
    await db.refresh(req)
    return req


@router.delete("/api/v1/testimonial-requests/{req_id}", status_code=204)
async def delete_request(req_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        select(models.TestimonialRequest).where(models.TestimonialRequest.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404)
    await db.delete(req)
    await db.commit()
