import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth import require_auth
from app.cache import cache

router = APIRouter(prefix="/about", tags=["about"])

SINGLETON_ID = 1


# ── Certification helpers ─────────────────────────────────────────────────────

async def _unique_link_slug(db: AsyncSession, name: str) -> str:
    """Build a stable, unique tracked-link slug from a cert name (e.g. cert-psm-i)."""
    base = "cert-" + re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    base = base.rstrip("-") or "cert"
    slug = base
    n = 1
    while True:
        existing = await db.execute(
            select(models.TrackedLink).where(models.TrackedLink.slug == slug)
        )
        if existing.scalar_one_or_none() is None:
            return slug
        n += 1
        slug = f"{base}-{n}"


def _cert_response(cert: models.Certification) -> schemas.CertificationResponse:
    return schemas.CertificationResponse(
        id=cert.id,
        name=cert.name,
        issuer=cert.issuer,
        image_url=cert.image_url,
        image_key=cert.image_key,
        verify_url=cert.verify_url,
        category=cert.category,
        featured=cert.featured,
        sort_order=cert.sort_order,
        tracked_link_id=cert.tracked_link_id,
        verify_slug=cert.tracked_link.slug if cert.tracked_link else None,
    )


async def _sync_tracked_link(db: AsyncSession, cert: models.Certification) -> None:
    """Keep the cert's auto-created tracked link in step with its verify_url/name.

    - verify_url set, no link  → create a /go/{slug} link
    - verify_url set, has link → update destination + label
    - verify_url cleared        → delete the link
    """
    link = cert.tracked_link
    verify = (cert.verify_url or "").strip()

    if not verify:
        if link is not None:
            await db.delete(link)
            cert.tracked_link = None
            cert.tracked_link_id = None
        return

    if link is None:
        slug = await _unique_link_slug(db, cert.name)
        link = models.TrackedLink(slug=slug, destination_url=verify, label=cert.name or slug)
        db.add(link)
        await db.flush()
        cert.tracked_link = link
        cert.tracked_link_id = link.id
    else:
        link.destination_url = verify
        link.label = cert.name or link.label


# ── About singleton ───────────────────────────────────────────────────────────

@router.get("", response_model=schemas.AboutResponse)
async def get_about(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.About).where(models.About.id == SINGLETON_ID))
    about = result.scalar_one_or_none()
    if not about:
        raise HTTPException(status_code=404, detail="About content not found")
    return about


@router.put("", response_model=schemas.AboutResponse)
async def upsert_about(payload: schemas.AboutUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.About).where(models.About.id == SINGLETON_ID))
    about = result.scalar_one_or_none()

    if about is None:
        about = models.About(id=SINGLETON_ID)
        db.add(about)

    for key, value in payload.model_dump(exclude_unset=True).items():
        # Serialize nested Pydantic models to plain dicts for JSON columns
        if isinstance(value, list):
            value = [v.model_dump() if hasattr(v, "model_dump") else v for v in value]
        setattr(about, key, value)

    await db.commit()
    await db.refresh(about)
    await cache.delete("page:about")
    return about


# ── Interests ─────────────────────────────────────────────────────────────────

@router.get("/interests", response_model=List[schemas.InterestResponse])
async def list_interests(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Interest).order_by(models.Interest.sort_order))
    return result.scalars().all()


@router.get("/interests/{interest_id}", response_model=schemas.InterestResponse)
async def get_interest(interest_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Interest).where(models.Interest.id == interest_id)
    )
    interest = result.scalar_one_or_none()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    return interest


@router.post(
    "/interests", response_model=schemas.InterestResponse, status_code=status.HTTP_201_CREATED
)
async def create_interest(payload: schemas.InterestCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    interest = models.Interest(**payload.model_dump())
    db.add(interest)
    await db.commit()
    await db.refresh(interest)
    await cache.delete("page:about")
    return interest


@router.put("/interests/{interest_id}", response_model=schemas.InterestResponse)
async def update_interest(
    interest_id: int, payload: schemas.InterestUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.Interest).where(models.Interest.id == interest_id)
    )
    interest = result.scalar_one_or_none()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(interest, key, value)
    await db.commit()
    await db.refresh(interest)
    await cache.delete("page:about")
    return interest


@router.delete("/interests/{interest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interest(interest_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Interest).where(models.Interest.id == interest_id)
    )
    interest = result.scalar_one_or_none()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    await db.delete(interest)
    await db.commit()
    await cache.delete("page:about")


# ── Coursework ────────────────────────────────────────────────────────────────

@router.get("/coursework", response_model=List[schemas.CourseworkResponse])
async def list_coursework(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Coursework).order_by(models.Coursework.sort_order))
    return result.scalars().all()


@router.get("/coursework/{coursework_id}", response_model=schemas.CourseworkResponse)
async def get_coursework(coursework_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Coursework).where(models.Coursework.id == coursework_id)
    )
    cw = result.scalar_one_or_none()
    if not cw:
        raise HTTPException(status_code=404, detail="Coursework not found")
    return cw


@router.post(
    "/coursework", response_model=schemas.CourseworkResponse, status_code=status.HTTP_201_CREATED
)
async def create_coursework(payload: schemas.CourseworkCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    cw = models.Coursework(**payload.model_dump())
    db.add(cw)
    await db.commit()
    await db.refresh(cw)
    await cache.delete("page:about")
    return cw


@router.put("/coursework/{coursework_id}", response_model=schemas.CourseworkResponse)
async def update_coursework(
    coursework_id: int, payload: schemas.CourseworkUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)
):
    result = await db.execute(
        select(models.Coursework).where(models.Coursework.id == coursework_id)
    )
    cw = result.scalar_one_or_none()
    if not cw:
        raise HTTPException(status_code=404, detail="Coursework not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(cw, key, value)
    await db.commit()
    await db.refresh(cw)
    await cache.delete("page:about")
    return cw


@router.delete("/coursework/{coursework_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coursework(coursework_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Coursework).where(models.Coursework.id == coursework_id)
    )
    cw = result.scalar_one_or_none()
    if not cw:
        raise HTTPException(status_code=404, detail="Coursework not found")
    await db.delete(cw)
    await db.commit()
    await cache.delete("page:about")


# ── Testimonials ─────────────────────────────────────────────────────────────

@router.get("/testimonials", response_model=List[schemas.TestimonialResponse])
async def list_testimonials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Testimonial).order_by(models.Testimonial.sort_order))
    return result.scalars().all()


@router.post("/testimonials", response_model=schemas.TestimonialResponse, status_code=status.HTTP_201_CREATED)
async def create_testimonial(payload: schemas.TestimonialCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    t = models.Testimonial(**payload.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    await cache.delete("page:about")
    await cache.delete("page:home")
    return t


@router.put("/testimonials/{tid}", response_model=schemas.TestimonialResponse)
async def update_testimonial(tid: int, payload: schemas.TestimonialUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Testimonial).where(models.Testimonial.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(t, key, value)
    await db.commit()
    await db.refresh(t)
    await cache.delete("page:about")
    await cache.delete("page:home")
    return t


@router.delete("/testimonials/{tid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(tid: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Testimonial).where(models.Testimonial.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.delete(t)
    await db.commit()
    await cache.delete("page:about")
    await cache.delete("page:home")


# ── Certifications ────────────────────────────────────────────────────────────

@router.get("/certifications", response_model=List[schemas.CertificationResponse])
async def list_certifications(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Certification).order_by(models.Certification.sort_order, models.Certification.id)
    )
    return [_cert_response(c) for c in result.scalars().unique().all()]


@router.post("/certifications", response_model=schemas.CertificationResponse, status_code=status.HTTP_201_CREATED)
async def create_certification(payload: schemas.CertificationCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    cert = models.Certification(**payload.model_dump())
    db.add(cert)
    await db.flush()
    await _sync_tracked_link(db, cert)
    await db.commit()
    await db.refresh(cert)
    await cache.delete("page:about")
    return _cert_response(cert)


@router.put("/certifications/{cert_id}", response_model=schemas.CertificationResponse)
async def update_certification(cert_id: int, payload: schemas.CertificationUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Certification).where(models.Certification.id == cert_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(cert, key, value)
    await _sync_tracked_link(db, cert)
    await db.commit()
    await db.refresh(cert)
    await cache.delete("page:about")
    return _cert_response(cert)


@router.delete("/certifications/{cert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certification(cert_id: int, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Certification).where(models.Certification.id == cert_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")
    if cert.tracked_link is not None:
        await db.delete(cert.tracked_link)
    await db.delete(cert)
    await db.commit()
    await cache.delete("page:about")
