import uuid
from datetime import datetime, date, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import require_auth
from app.models import (
    Company, JobPosting, Application, InterviewRound,
    ApplicationStatusEvent, Offer, Rejection, Tag, ApplicationTag,
    ApplicationStatus, PriorityTier, RoleType, WorkArrangement,
    ApplicationSource, RoundType, RoundOutcome,
)
from app.schemas import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    ApplicationCreate, ApplicationUpdate, ApplicationListItem,
    InterviewRoundCreate, InterviewRoundUpdate, InterviewRoundResponse,
    OfferCreate, OfferUpdate, OfferResponse,
    TagCreate, TagResponse,
    StatusEventCreate,
    DashboardStats,
)

router = APIRouter(prefix="/internships", tags=["internships"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _enum_val(val) -> str | None:
    if val is None:
        return None
    return val.value if hasattr(val, 'value') else str(val)


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    return date.fromisoformat(val)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    # Total applications (non-archived)
    total_q = await db.execute(
        select(func.count(Application.id)).where(Application.archived_at.is_(None))
    )
    total_applications = total_q.scalar() or 0

    # Status counts
    status_q = await db.execute(
        select(Application.current_status, func.count(Application.id))
        .where(Application.archived_at.is_(None))
        .group_by(Application.current_status)
    )
    status_counts = {row[0]: row[1] for row in status_q.all()}

    # Priority counts
    priority_q = await db.execute(
        select(Application.priority, func.count(Application.id))
        .where(Application.archived_at.is_(None))
        .group_by(Application.priority)
    )
    priority_counts = {row[0]: row[1] for row in priority_q.all()}

    # Source counts
    source_q = await db.execute(
        select(Application.source, func.count(Application.id))
        .where(Application.archived_at.is_(None))
        .group_by(Application.source)
    )
    source_counts = {(row[0] or "unknown"): row[1] for row in source_q.all()}

    def _app_to_item(app):
        posting = app.job_posting
        company = posting.company if posting else None
        return {
            "id": str(app.id),
            "company_name": company.name if company else None,
            "job_title": posting.title if posting else None,
            "current_status": _enum_val(app.current_status),
            "priority": _enum_val(app.priority),
            "next_action": app.next_action,
            "next_action_due": str(app.next_action_due) if app.next_action_due else None,
            "created_at": str(app.created_at) if app.created_at else None,
            "tags": [],
        }

    _eager = selectinload(Application.job_posting).selectinload(JobPosting.company)

    # Upcoming actions (next 5 due)
    upcoming_q = await db.execute(
        select(Application)
        .where(
            and_(
                Application.archived_at.is_(None),
                Application.next_action_due.isnot(None),
            )
        )
        .options(_eager)
        .order_by(Application.next_action_due.asc())
        .limit(5)
    )
    upcoming_apps = upcoming_q.scalars().unique().all()
    upcoming_actions = [_app_to_item(a) for a in upcoming_apps]

    # Recent applications (last 5 created)
    recent_q = await db.execute(
        select(Application)
        .where(Application.archived_at.is_(None))
        .options(_eager)
        .order_by(Application.created_at.desc())
        .limit(5)
    )
    recent_apps = recent_q.scalars().unique().all()
    recent_applications = [_app_to_item(a) for a in recent_apps]

    # Normalize status_counts keys to strings
    normalized_status = {}
    for k, v in status_counts.items():
        normalized_status[str(k) if not isinstance(k, str) else k] = v

    normalized_priority = {}
    for k, v in priority_counts.items():
        normalized_priority[str(k) if not isinstance(k, str) else k] = v

    normalized_source = {}
    for k, v in source_counts.items():
        normalized_source[str(k) if not isinstance(k, str) else k] = v

    # Response rate
    wishlist_count = normalized_status.get("wishlist", 0)
    drafting_count = normalized_status.get("drafting", 0)
    applied_count = normalized_status.get("applied", 0)
    early_stage = wishlist_count + drafting_count + applied_count
    past_applied = total_applications - early_stage
    response_rate = past_applied / total_applications if total_applications > 0 else 0.0

    # Offer rate
    offer_count_q = await db.execute(select(func.count(Offer.id)))
    offer_count = offer_count_q.scalar() or 0
    offer_rate = offer_count / total_applications if total_applications > 0 else 0.0

    return {
        "total_applications": total_applications,
        "status_counts": normalized_status,
        "priority_counts": normalized_priority,
        "source_counts": normalized_source,
        "upcoming_actions": upcoming_actions,
        "recent_applications": recent_applications,
        "response_rate": round(response_rate, 4),
        "offer_rate": round(offer_rate, 4),
    }


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------

@router.get("/companies", response_model=List[CompanyResponse])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Company).order_by(Company.name))
    return result.scalars().all()


@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    now = _now()
    company = Company(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.put("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    payload: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(company, key, value)
    company.updated_at = _now()

    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    await db.commit()


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

@router.get("/applications", response_model=List[ApplicationListItem])
async def list_applications(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(Application)
        .where(Application.archived_at.is_(None))
        .options(
            selectinload(Application.job_posting).selectinload(JobPosting.company),
            selectinload(Application.tags),
        )
        .order_by(Application.created_at.desc())
    )
    apps = result.scalars().unique().all()

    items = []
    for app in apps:
        posting = app.job_posting
        company = posting.company if posting else None
        tags = [
            {"id": str(t.id), "name": t.name, "color": t.color}
            for t in (app.tags or [])
        ]
        items.append({
            "id": str(app.id),
            "company_name": company.name if company else None,
            "company_id": str(posting.company_id) if posting else None,
            "job_posting_id": str(app.job_posting_id),
            "job_title": posting.title if posting else None,
            "team": posting.team if posting else None,
            "role_type": _enum_val(posting.role_type) if posting else None,
            "work_arrangement": _enum_val(posting.work_arrangement) if posting else None,
            "location_city": posting.location_city if posting else None,
            "posting_url": posting.posting_url if posting else None,
            "current_status": _enum_val(app.current_status),
            "priority": _enum_val(app.priority),
            "source": _enum_val(app.source),
            "applied_on": str(app.applied_on) if app.applied_on else None,
            "next_action": app.next_action,
            "next_action_due": str(app.next_action_due) if app.next_action_due else None,
            "personal_notes": app.personal_notes,
            "created_at": str(app.created_at) if app.created_at else None,
            "updated_at": str(app.updated_at) if app.updated_at else None,
            "tags": tags,
        })
    return items


@router.post("/applications", response_model=ApplicationListItem, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    now = _now()

    # Find or create company
    company_id = payload.company_id
    if not company_id and payload.company_name:
        result = await db.execute(
            select(Company).where(func.lower(Company.name) == payload.company_name.lower())
        )
        company = result.scalar_one_or_none()
        if company:
            company_id = str(company.id)
        else:
            company_id = str(uuid.uuid4())
            new_company = Company(
                id=company_id,
                name=payload.company_name,
                created_at=now,
                updated_at=now,
            )
            db.add(new_company)

    # Create the job posting
    posting_id = str(uuid.uuid4())
    posting = JobPosting(
        id=posting_id,
        company_id=company_id,
        title=payload.job_title,
        team=payload.team,
        role_type=payload.role_type,
        work_arrangement=payload.work_arrangement,
        location_city=payload.location_city,
        posting_url=payload.posting_url,
        created_at=now,
        updated_at=now,
    )
    db.add(posting)

    # Create the application
    app_id = str(uuid.uuid4())
    application = Application(
        id=app_id,
        job_posting_id=posting_id,
        current_status=payload.current_status or "wishlist",
        priority=payload.priority or "medium",
        source=payload.source,
        applied_on=_parse_date(payload.applied_on),
        next_action=payload.next_action,
        next_action_due=_parse_date(payload.next_action_due),
        personal_notes=payload.personal_notes,
        created_at=now,
        updated_at=now,
    )
    db.add(application)
    await db.commit()

    return {
        "id": str(app_id),
        "company_name": payload.company_name,
        "company_id": str(company_id),
        "job_posting_id": str(posting_id),
        "job_title": payload.job_title,
        "team": payload.team,
        "role_type": payload.role_type,
        "current_status": payload.current_status or "wishlist",
        "priority": payload.priority or "medium",
        "source": payload.source,
        "applied_on": payload.applied_on,
        "next_action": payload.next_action,
        "next_action_due": payload.next_action_due,
        "personal_notes": payload.personal_notes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "tags": [],
    }


@router.put("/applications/{app_id}", response_model=ApplicationListItem)
async def update_application(
    app_id: str,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(Application)
        .where(Application.id == app_id)
        .options(
            selectinload(Application.job_posting).selectinload(JobPosting.company),
            selectinload(Application.tags),
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(app, key, value)
    app.updated_at = _now()

    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Application)
        .where(Application.id == app_id)
        .options(
            selectinload(Application.job_posting).selectinload(JobPosting.company),
            selectinload(Application.tags),
        )
    )
    app = result.scalar_one()
    posting = app.job_posting
    company = posting.company if posting else None
    tags = [
        {"id": str(t.id), "name": t.name, "color": t.color}
        for t in (app.tags or [])
    ]

    return {
        "id": str(app.id),
        "company_name": company.name if company else None,
        "company_id": str(posting.company_id) if posting else None,
        "job_posting_id": str(app.job_posting_id),
        "job_title": posting.title if posting else None,
        "team": posting.team if posting else None,
        "role_type": _enum_val(posting.role_type) if posting else None,
        "current_status": _enum_val(app.current_status),
        "priority": _enum_val(app.priority),
        "source": _enum_val(app.source),
        "applied_on": str(app.applied_on) if app.applied_on else None,
        "next_action": app.next_action,
        "next_action_due": str(app.next_action_due) if app.next_action_due else None,
        "personal_notes": app.personal_notes,
        "created_at": str(app.created_at) if app.created_at else None,
        "updated_at": str(app.updated_at) if app.updated_at else None,
        "tags": tags,
    }


@router.delete("/applications/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.archived_at = _now()
    app.updated_at = _now()
    await db.commit()


@router.post("/applications/{app_id}/status", status_code=status.HTTP_201_CREATED)
async def add_status_event(
    app_id: str,
    payload: StatusEventCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = _now()
    event = ApplicationStatusEvent(
        id=str(uuid.uuid4()),
        application_id=app_id,
        status=payload.status,
        note=payload.note,
        changed_at=now,
    )
    db.add(event)

    # Update the application's current status
    app.current_status = payload.status
    app.updated_at = now

    await db.commit()
    await db.refresh(event)
    return event


# ---------------------------------------------------------------------------
# Interview Rounds
# ---------------------------------------------------------------------------

@router.get("/applications/{app_id}/rounds", response_model=List[InterviewRoundResponse])
async def list_rounds(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.application_id == app_id)
        .order_by(InterviewRound.round_number)
    )
    return result.scalars().all()


@router.post(
    "/applications/{app_id}/rounds",
    response_model=InterviewRoundResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_round(
    app_id: str,
    payload: InterviewRoundCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    # Verify application exists
    app_result = await db.execute(select(Application).where(Application.id == app_id))
    if not app_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Application not found")

    now = _now()
    round_ = InterviewRound(
        id=str(uuid.uuid4()),
        application_id=app_id,
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(round_)
    await db.commit()
    await db.refresh(round_)
    return round_


@router.put("/rounds/{round_id}", response_model=InterviewRoundResponse)
async def update_round(
    round_id: str,
    payload: InterviewRoundUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Interview round not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(round_, key, value)
    round_.updated_at = _now()

    await db.commit()
    await db.refresh(round_)
    return round_


@router.delete("/rounds/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(
    round_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Interview round not found")
    await db.delete(round_)
    await db.commit()


# ---------------------------------------------------------------------------
# Offers
# ---------------------------------------------------------------------------

@router.post(
    "/applications/{app_id}/offer",
    response_model=OfferResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_offer(
    app_id: str,
    payload: OfferCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    # Verify application exists
    app_result = await db.execute(select(Application).where(Application.id == app_id))
    if not app_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Application not found")

    now = _now()
    offer = Offer(
        id=str(uuid.uuid4()),
        application_id=app_id,
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return offer


@router.put("/offers/{offer_id}", response_model=OfferResponse)
async def update_offer(
    offer_id: str,
    payload: OfferUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Offer).where(Offer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(offer, key, value)
    offer.updated_at = _now()

    await db.commit()
    await db.refresh(offer)
    return offer


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=List[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Tag).order_by(Tag.name))
    return result.scalars().all()


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    tag = Tag(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


@router.post(
    "/applications/{app_id}/tags/{tag_id}",
    status_code=status.HTTP_201_CREATED,
)
async def add_tag_to_application(
    app_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    # Verify both exist
    app_result = await db.execute(select(Application).where(Application.id == app_id))
    if not app_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Application not found")

    tag_result = await db.execute(select(Tag).where(Tag.id == tag_id))
    if not tag_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if already linked
    existing = await db.execute(
        select(ApplicationTag).where(
            and_(
                ApplicationTag.application_id == app_id,
                ApplicationTag.tag_id == tag_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already applied")

    link = ApplicationTag(
        application_id=app_id,
        tag_id=tag_id,
    )
    db.add(link)
    await db.commit()
    return {"status": "ok"}


@router.delete(
    "/applications/{app_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_tag_from_application(
    app_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(ApplicationTag).where(
            and_(
                ApplicationTag.application_id == app_id,
                ApplicationTag.tag_id == tag_id,
            )
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Tag not linked to application")
    await db.delete(link)
    await db.commit()
