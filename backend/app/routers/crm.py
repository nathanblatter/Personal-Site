"""Consulting CRM — contacts, organizations, pipeline deals, engagements,
contracts, time tracking, and invoicing.

All admin endpoints require auth. Client-facing magic-link endpoints live under
/crm/public/* and are intentionally unauthenticated (guarded by an unguessable
per-record token).
"""
import secrets
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app import models, schemas, crm_utils
from app.auth import require_auth
from app.utils import get_client_ip, get_redis
from app.email_service import send_contract_otp_email

router = APIRouter(prefix="/crm", tags=["crm"])

OTP_TTL = 600          # 10 minutes
OTP_VERIFIED_TTL = 1800  # 30 minutes to complete signing after verifying


async def _log_contract(db, contract_id, type, request=None, **kw):
    return await crm_utils.log_contract_event(
        db, contract_id=contract_id, type=type,
        ip=get_client_ip(request) if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
        **kw,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ══════════════════════════════════════════════════════════════════════════════
# Organizations
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/organizations", response_model=List[schemas.OrganizationResponse])
async def list_organizations(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Organization).order_by(models.Organization.name))
    return result.scalars().all()


@router.post("/organizations", response_model=schemas.OrganizationResponse, status_code=201)
async def create_organization(payload: schemas.OrganizationCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    now = _now()
    org = models.Organization(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@router.put("/organizations/{org_id}", response_model=schemas.OrganizationResponse)
async def update_organization(org_id: str, payload: schemas.OrganizationUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    org = await db.get(models.Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(org, k, v)
    org.updated_at = _now()
    await db.commit()
    await db.refresh(org)
    return org


@router.delete("/organizations/{org_id}", status_code=204)
async def delete_organization(org_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    org = await db.get(models.Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    await db.delete(org)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Contacts
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/contacts", response_model=List[schemas.ContactResponse])
async def list_contacts(q: Optional[str] = None, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    stmt = select(models.Contact).order_by(models.Contact.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            func.lower(models.Contact.name).like(like)
            | func.lower(func.coalesce(models.Contact.email, "")).like(like)
            | func.lower(func.coalesce(models.Contact.company_name, "")).like(like)
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/contacts", response_model=schemas.ContactResponse, status_code=201)
async def create_contact(payload: schemas.ContactCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    now = _now()
    data = payload.model_dump()
    data.setdefault("source", models.ContactSource.manual)
    contact = models.Contact(**data, created_at=now, updated_at=now)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.get("/contacts/{contact_id}", response_model=schemas.ContactDetail)
async def get_contact(contact_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Contact)
        .where(models.Contact.id == contact_id)
        .options(
            selectinload(models.Contact.organization),
            selectinload(models.Contact.activities),
            selectinload(models.Contact.deals),
            selectinload(models.Contact.engagements),
        )
    )
    contact = result.scalars().first()
    if not contact:
        raise HTTPException(404, "Contact not found")

    bookings_res = await db.execute(
        select(models.Booking).where(models.Booking.contact_id == contact_id).order_by(models.Booking.start_at.desc())
    )
    bookings = bookings_res.scalars().all()

    detail = schemas.ContactDetail.model_validate(contact)
    detail.activities = sorted(
        [schemas.ActivityResponse.model_validate(a) for a in contact.activities],
        key=lambda a: a.occurred_at, reverse=True,
    )
    detail.deals = [schemas.DealResponse.model_validate(d) for d in contact.deals]
    detail.engagements = [schemas.EngagementResponse.model_validate(e) for e in contact.engagements]
    detail.bookings = [schemas.ContactBookingRef.model_validate(b) for b in bookings]
    return detail


@router.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
async def update_contact(contact_id: str, payload: schemas.ContactUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contact = await db.get(models.Contact, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    contact.updated_at = _now()
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contact = await db.get(models.Contact, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()


@router.post("/contacts/{contact_id}/activities", response_model=schemas.ActivityResponse, status_code=201)
async def add_activity(contact_id: str, payload: schemas.ActivityCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contact = await db.get(models.Contact, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")
    activity = await crm_utils.log_activity(
        db, contact_id=contact_id, type=payload.type, body_md=payload.body_md,
        engagement_id=payload.engagement_id, occurred_at=payload.occurred_at,
    )
    await db.commit()
    await db.refresh(activity)
    return activity


# ══════════════════════════════════════════════════════════════════════════════
# Deals (pipeline)
# ══════════════════════════════════════════════════════════════════════════════

def _attach_contact_name(objs, contacts_by_id):
    for o in objs:
        c = contacts_by_id.get(o.contact_id)
        o.contact_name = c.name if c else None
    return objs


async def _contacts_map(db: AsyncSession, ids):
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    res = await db.execute(select(models.Contact).where(models.Contact.id.in_(ids)))
    return {c.id: c for c in res.scalars().all()}


@router.get("/deals", response_model=List[schemas.DealResponse])
async def list_deals(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Deal).order_by(models.Deal.updated_at.desc()))
    deals = result.scalars().all()
    cmap = await _contacts_map(db, [d.contact_id for d in deals])
    return _attach_contact_name(deals, cmap)


@router.post("/deals", response_model=schemas.DealResponse, status_code=201)
async def create_deal(payload: schemas.DealCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    now = _now()
    deal = models.Deal(**payload.model_dump(), created_at=now, updated_at=now)
    if deal.stage == models.DealStage.won:
        deal.won_at = now
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    contact = await db.get(models.Contact, deal.contact_id)
    deal.contact_name = contact.name if contact else None
    return deal


@router.put("/deals/{deal_id}", response_model=schemas.DealResponse)
async def update_deal(deal_id: str, payload: schemas.DealUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    deal = await db.get(models.Deal, deal_id)
    if not deal:
        raise HTTPException(404, "Deal not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(deal, k, v)
    deal.updated_at = _now()
    await db.commit()
    await db.refresh(deal)
    contact = await db.get(models.Contact, deal.contact_id)
    deal.contact_name = contact.name if contact else None
    return deal


@router.post("/deals/{deal_id}/stage", response_model=None)
async def set_deal_stage(deal_id: str, payload: schemas.DealStageUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    """Advance a deal's stage. Moving to 'won' creates a new Engagement and
    returns {"deal": ..., "engagement": ...}; otherwise {"deal": ...}."""
    deal = await db.execute(
        select(models.Deal).where(models.Deal.id == deal_id).options(selectinload(models.Deal.engagement))
    )
    deal = deal.scalars().first()
    if not deal:
        raise HTTPException(404, "Deal not found")

    now = _now()
    prev_stage = deal.stage
    deal.stage = payload.stage
    deal.updated_at = now
    if payload.stage == models.DealStage.lost:
        deal.lost_reason = payload.lost_reason

    # Log a status-change activity on the contact's timeline.
    await crm_utils.log_activity(
        db, contact_id=deal.contact_id, type=models.ActivityType.status_change,
        body_md=f"Deal **{deal.title}**: {prev_stage.value} → {payload.stage.value}",
    )

    if payload.stage == models.DealStage.won and deal.engagement is None:
        deal.won_at = now
        engagement = models.Engagement(
            contact_id=deal.contact_id,
            organization_id=deal.organization_id,
            deal_id=deal.id,
            title=deal.title,
            status=models.EngagementStatus.active,
            billing_type=models.BillingType.hourly,
            currency=deal.currency,
            fixed_amount_cents=deal.value_cents,
            created_at=now,
            updated_at=now,
        )
        db.add(engagement)
        await db.commit()
        await db.refresh(engagement)
        await db.refresh(deal)
        contact = await db.get(models.Contact, engagement.contact_id)
        deal.contact_name = contact.name if contact else None
        engagement.contact_name = contact.name if contact else None
        return {
            "deal": schemas.DealResponse.model_validate(deal),
            "engagement": schemas.EngagementResponse.model_validate(engagement),
        }

    await db.commit()
    await db.refresh(deal)
    contact = await db.get(models.Contact, deal.contact_id)
    deal.contact_name = contact.name if contact else None
    return {"deal": schemas.DealResponse.model_validate(deal)}


@router.delete("/deals/{deal_id}", status_code=204)
async def delete_deal(deal_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    deal = await db.get(models.Deal, deal_id)
    if not deal:
        raise HTTPException(404, "Deal not found")
    await db.delete(deal)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Engagements
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/engagements", response_model=List[schemas.EngagementResponse])
async def list_engagements(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(select(models.Engagement).order_by(models.Engagement.updated_at.desc()))
    engagements = result.scalars().all()
    cmap = await _contacts_map(db, [e.contact_id for e in engagements])
    return _attach_contact_name(engagements, cmap)


@router.post("/engagements", response_model=schemas.EngagementResponse, status_code=201)
async def create_engagement(payload: schemas.EngagementCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    now = _now()
    engagement = models.Engagement(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(engagement)
    await db.commit()
    await db.refresh(engagement)
    contact = await db.get(models.Contact, engagement.contact_id)
    engagement.contact_name = contact.name if contact else None
    return engagement


@router.get("/engagements/{engagement_id}", response_model=schemas.EngagementDetail)
async def get_engagement(engagement_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.Engagement)
        .where(models.Engagement.id == engagement_id)
        .options(
            selectinload(models.Engagement.contracts),
            selectinload(models.Engagement.time_entries),
            selectinload(models.Engagement.invoices).selectinload(models.Invoice.line_items),
            selectinload(models.Engagement.invoices).selectinload(models.Invoice.payments),
        )
    )
    engagement = result.scalars().first()
    if not engagement:
        raise HTTPException(404, "Engagement not found")
    contact = await db.get(models.Contact, engagement.contact_id)
    detail = schemas.EngagementDetail.model_validate(engagement)
    detail.contact_name = contact.name if contact else None
    detail.contracts = sorted(
        [schemas.ContractResponse.model_validate(c) for c in engagement.contracts],
        key=lambda c: c.created_at, reverse=True,
    )
    detail.time_entries = sorted(
        [schemas.TimeEntryResponse.model_validate(t) for t in engagement.time_entries],
        key=lambda t: t.entry_date, reverse=True,
    )
    detail.invoices = sorted(
        [schemas.InvoiceResponse.model_validate(i) for i in engagement.invoices],
        key=lambda i: i.created_at, reverse=True,
    )
    return detail


@router.put("/engagements/{engagement_id}", response_model=schemas.EngagementResponse)
async def update_engagement(engagement_id: str, payload: schemas.EngagementUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    engagement = await db.get(models.Engagement, engagement_id)
    if not engagement:
        raise HTTPException(404, "Engagement not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(engagement, k, v)
    engagement.updated_at = _now()
    await db.commit()
    await db.refresh(engagement)
    contact = await db.get(models.Contact, engagement.contact_id)
    engagement.contact_name = contact.name if contact else None
    return engagement


@router.delete("/engagements/{engagement_id}", status_code=204)
async def delete_engagement(engagement_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    engagement = await db.get(models.Engagement, engagement_id)
    if not engagement:
        raise HTTPException(404, "Engagement not found")
    await db.delete(engagement)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Contracts
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/contracts", response_model=schemas.ContractResponse, status_code=201)
async def create_contract(payload: schemas.ContractCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    now = _now()
    contract = models.Contract(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(contract)
    await db.flush()
    await _log_contract(db, contract.id, "created", actor_name=CONSULTANT_NAME, meta={"title": contract.title})
    await db.commit()
    await db.refresh(contract)
    return contract


@router.put("/contracts/{contract_id}", response_model=schemas.ContractResponse)
async def update_contract(contract_id: str, payload: schemas.ContractUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contract = await db.get(models.Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(contract, k, v)
    contract.updated_at = _now()
    await db.commit()
    await db.refresh(contract)
    return contract


CONSULTANT_NAME = "Nathan Blatter"


@router.post("/contracts/{contract_id}/send", response_model=schemas.ContractResponse)
async def send_contract(contract_id: str, request: Request, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    """Mint a public token and mark the contract as sent. Sending counts as the
    consultant's own signature (you wouldn't send it if you didn't agree), so we
    auto-counter-sign here. Returns the contract (the frontend builds the
    shareable /contract/{token} link)."""
    contract = await db.get(models.Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    now = _now()
    if not contract.public_token:
        contract.public_token = crm_utils.make_public_token()
    contract.status = models.ContractStatus.sent
    contract.sent_at = now
    if not contract.consultant_signed_at:
        contract.consultant_signed_name = CONSULTANT_NAME
        contract.consultant_signed_at = now
        await _log_contract(db, contract.id, "signed", request, actor_name=CONSULTANT_NAME,
                            meta={"party": "consultant"})
    await _log_contract(db, contract.id, "sent", request, actor_name=CONSULTANT_NAME)
    contract.updated_at = now
    await db.commit()
    await db.refresh(contract)
    return contract


async def _render_contract(db: AsyncSession, contract: models.Contract) -> bytes:
    """Serve the frozen executed PDF when present (tamper-evident); otherwise
    render live from current data."""
    if contract.executed_pdf:
        return bytes(contract.executed_pdf)
    from app.crm_pdf import render_contract_pdf
    contact = await _contract_contact(db, contract)
    return render_contract_pdf(contract, contact)


@router.get("/contracts/{contract_id}/pdf")
async def contract_pdf(contract_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contract = await db.get(models.Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    pdf = await _render_contract(db, contract)
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="{_slug(contract.title)}.pdf"'
    })


@router.delete("/contracts/{contract_id}", status_code=204)
async def delete_contract(contract_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    contract = await db.get(models.Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    await db.delete(contract)
    await db.commit()


async def _contract_contact(db: AsyncSession, contract: models.Contract):
    """Resolve the client contact for a contract via its engagement."""
    eng = await db.get(models.Engagement, contract.engagement_id)
    if eng and eng.contact_id:
        return await db.get(models.Contact, eng.contact_id)
    return None


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in (text or "contract")).strip("-").lower() or "contract"


# ══════════════════════════════════════════════════════════════════════════════
# Time entries
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/time-entries", response_model=List[schemas.TimeEntryResponse])
async def list_time_entries(engagement_id: str, unbilled: bool = False, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    stmt = select(models.TimeEntry).where(models.TimeEntry.engagement_id == engagement_id)
    if unbilled:
        stmt = stmt.where(models.TimeEntry.billable.is_(True), models.TimeEntry.invoice_id.is_(None))
    stmt = stmt.order_by(models.TimeEntry.entry_date.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/time-entries", response_model=schemas.TimeEntryResponse, status_code=201)
async def create_time_entry(payload: schemas.TimeEntryCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    entry = models.TimeEntry(**payload.model_dump(), created_at=_now())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.put("/time-entries/{entry_id}", response_model=schemas.TimeEntryResponse)
async def update_time_entry(entry_id: str, payload: schemas.TimeEntryUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    entry = await db.get(models.TimeEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Time entry not found")
    if entry.invoice_id:
        raise HTTPException(400, "Cannot edit a time entry that has been invoiced")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/time-entries/{entry_id}", status_code=204)
async def delete_time_entry(entry_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    entry = await db.get(models.TimeEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Time entry not found")
    if entry.invoice_id:
        raise HTTPException(400, "Cannot delete a time entry that has been invoiced")
    await db.delete(entry)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Invoices
# ══════════════════════════════════════════════════════════════════════════════

async def _load_invoice(db: AsyncSession, invoice_id: str) -> models.Invoice:
    result = await db.execute(
        select(models.Invoice)
        .where(models.Invoice.id == invoice_id)
        .options(selectinload(models.Invoice.line_items), selectinload(models.Invoice.payments))
    )
    inv = result.scalars().first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.get("/invoices", response_model=List[schemas.InvoiceResponse])
async def list_invoices(engagement_id: Optional[str] = None, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    stmt = select(models.Invoice).options(
        selectinload(models.Invoice.line_items), selectinload(models.Invoice.payments)
    )
    if engagement_id:
        stmt = stmt.where(models.Invoice.engagement_id == engagement_id)
    stmt = stmt.order_by(models.Invoice.created_at.desc())
    result = await db.execute(stmt)
    invoices = result.scalars().all()
    cmap = await _contacts_map(db, [i.contact_id for i in invoices])
    for inv in invoices:
        c = cmap.get(inv.contact_id)
        inv.contact_name = c.name if c else None
    return invoices


@router.post("/invoices", response_model=schemas.InvoiceResponse, status_code=201)
async def create_invoice(payload: schemas.InvoiceCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    engagement = await db.get(models.Engagement, payload.engagement_id)
    if not engagement:
        raise HTTPException(404, "Engagement not found")
    now = _now()
    inv = models.Invoice(
        engagement_id=engagement.id,
        contact_id=engagement.contact_id,
        organization_id=engagement.organization_id,
        number=await crm_utils.next_invoice_number(db),
        status=models.InvoiceStatus.draft,
        issue_date=payload.issue_date or date.today(),
        due_date=payload.due_date,
        currency=payload.currency,
        tax_cents=payload.tax_cents,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    for i, li in enumerate(payload.line_items):
        inv.line_items.append(models.InvoiceLineItem(
            description=li.description, quantity=li.quantity,
            unit_price_cents=li.unit_price_cents, amount_cents=li.amount_cents, sort_order=i,
        ))
    crm_utils.recalc_invoice_totals(inv)
    db.add(inv)
    await db.commit()
    return await _invoice_response(db, inv.id)


@router.post("/invoices/generate", response_model=schemas.InvoiceResponse, status_code=201)
async def generate_invoice(payload: schemas.InvoiceGenerate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    """Build an invoice from an engagement's billing model:
    - hourly: one line per unbilled billable time entry (marks them billed)
    - fixed: a single line for the fixed fee
    - retainer: a single line for the period's retainer
    """
    engagement = await db.get(models.Engagement, payload.engagement_id)
    if not engagement:
        raise HTTPException(404, "Engagement not found")
    now = _now()
    inv = models.Invoice(
        engagement_id=engagement.id,
        contact_id=engagement.contact_id,
        organization_id=engagement.organization_id,
        number=await crm_utils.next_invoice_number(db),
        status=models.InvoiceStatus.draft,
        issue_date=date.today(),
        due_date=payload.due_date,
        currency=engagement.currency,
        tax_cents=payload.tax_cents,
        created_at=now,
        updated_at=now,
    )

    billed_entries: list[models.TimeEntry] = []
    if payload.mode == models.BillingType.hourly:
        res = await db.execute(
            select(models.TimeEntry).where(
                models.TimeEntry.engagement_id == engagement.id,
                models.TimeEntry.billable.is_(True),
                models.TimeEntry.invoice_id.is_(None),
            ).order_by(models.TimeEntry.entry_date)
        )
        entries = res.scalars().all()
        if not entries:
            raise HTTPException(400, "No unbilled hours to invoice")
        for i, e in enumerate(entries):
            rate = e.rate_cents_override or engagement.rate_cents or 0
            hours = round(e.minutes / 60, 2)
            amount = round(e.minutes / 60 * rate)
            desc = e.description or f"Work on {e.entry_date.isoformat()}"
            inv.line_items.append(models.InvoiceLineItem(
                description=desc, quantity=hours, unit_price_cents=rate,
                amount_cents=amount, sort_order=i,
            ))
            billed_entries.append(e)
    elif payload.mode == models.BillingType.fixed:
        amount = engagement.fixed_amount_cents or 0
        inv.line_items.append(models.InvoiceLineItem(
            description=engagement.title, quantity=1, unit_price_cents=amount, amount_cents=amount, sort_order=0,
        ))
    elif payload.mode == models.BillingType.retainer:
        amount = engagement.retainer_amount_cents or 0
        ps = payload.period_start or date.today().replace(day=1)
        pe = payload.period_end
        label = f"Monthly retainer — {ps.strftime('%B %Y')}"
        inv.is_retainer = True
        inv.period_start = ps
        inv.period_end = pe
        inv.line_items.append(models.InvoiceLineItem(
            description=label, quantity=1, unit_price_cents=amount, amount_cents=amount, sort_order=0,
        ))

    crm_utils.recalc_invoice_totals(inv)
    db.add(inv)
    await db.flush()
    for e in billed_entries:
        e.invoice_id = inv.id
    await db.commit()
    return await _invoice_response(db, inv.id)


@router.put("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
async def update_invoice(invoice_id: str, payload: schemas.InvoiceUpdate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    inv = await _load_invoice(db, invoice_id)
    data = payload.model_dump(exclude_unset=True)
    line_items = data.pop("line_items", None)
    for k, v in data.items():
        setattr(inv, k, v)
    if line_items is not None:
        inv.line_items.clear()
        await db.flush()
        for i, li in enumerate(line_items):
            inv.line_items.append(models.InvoiceLineItem(
                description=li["description"], quantity=li["quantity"],
                unit_price_cents=li["unit_price_cents"], amount_cents=li["amount_cents"], sort_order=i,
            ))
    crm_utils.recalc_invoice_totals(inv)
    inv.updated_at = _now()
    await db.commit()
    return await _invoice_response(db, inv.id)


@router.post("/invoices/{invoice_id}/send", response_model=schemas.InvoiceResponse)
async def send_invoice(invoice_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    inv = await _load_invoice(db, invoice_id)
    if not inv.public_token:
        inv.public_token = crm_utils.make_public_token()
    if inv.status == models.InvoiceStatus.draft:
        inv.status = models.InvoiceStatus.sent
    inv.sent_at = _now()
    inv.updated_at = _now()
    await db.commit()
    return await _invoice_response(db, inv.id)


@router.post("/invoices/{invoice_id}/payments", response_model=schemas.InvoiceResponse)
async def record_payment(invoice_id: str, payload: schemas.PaymentCreate, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    inv = await _load_invoice(db, invoice_id)
    payment = models.Payment(
        invoice_id=inv.id, amount_cents=payload.amount_cents, method=payload.method,
        reference=payload.reference, paid_at=payload.paid_at or _now(), note=payload.note,
    )
    db.add(payment)
    inv.amount_paid_cents = (inv.amount_paid_cents or 0) + payload.amount_cents
    if inv.status in (models.InvoiceStatus.draft,):
        inv.status = models.InvoiceStatus.sent
    crm_utils.recalc_invoice_totals(inv)
    if inv.status == models.InvoiceStatus.paid and not inv.paid_at:
        inv.paid_at = _now()
    inv.updated_at = _now()
    await db.commit()
    return await _invoice_response(db, inv.id)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(invoice_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    inv = await _load_invoice(db, invoice_id)
    # Release any time entries billed to this invoice.
    await db.execute(
        models.TimeEntry.__table__.update()
        .where(models.TimeEntry.invoice_id == inv.id)
        .values(invoice_id=None)
    )
    await db.delete(inv)
    await db.commit()


@router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    from app.crm_pdf import render_invoice_pdf
    inv = await _load_invoice(db, invoice_id)
    contact = await db.get(models.Contact, inv.contact_id) if inv.contact_id else None
    pdf = render_invoice_pdf(inv, contact)
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="{inv.number}.pdf"'
    })


async def _invoice_response(db: AsyncSession, invoice_id: str) -> schemas.InvoiceResponse:
    inv = await _load_invoice(db, invoice_id)
    resp = schemas.InvoiceResponse.model_validate(inv)
    if inv.contact_id:
        contact = await db.get(models.Contact, inv.contact_id)
        resp.contact_name = contact.name if contact else None
    return resp


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard", response_model=schemas.CrmDashboard)
async def crm_dashboard(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    # Pipeline counts by stage
    res = await db.execute(select(models.Deal.stage, func.count()).group_by(models.Deal.stage))
    pipeline_counts = {stage.value: count for stage, count in res.all()}

    open_stages = [models.DealStage.lead, models.DealStage.qualified, models.DealStage.proposal, models.DealStage.negotiation]
    res = await db.execute(
        select(func.coalesce(func.sum(models.Deal.value_cents), 0)).where(models.Deal.stage.in_(open_stages))
    )
    pipeline_value = res.scalar_one() or 0

    # Outstanding AR (unpaid balances)
    unpaid_statuses = [models.InvoiceStatus.sent, models.InvoiceStatus.partial, models.InvoiceStatus.overdue]
    res = await db.execute(
        select(func.coalesce(func.sum(models.Invoice.total_cents - models.Invoice.amount_paid_cents), 0))
        .where(models.Invoice.status.in_(unpaid_statuses))
    )
    outstanding_ar = res.scalar_one() or 0

    # Paid this month
    month_start = date.today().replace(day=1)
    res = await db.execute(
        select(func.coalesce(func.sum(models.Payment.amount_cents), 0))
        .where(models.Payment.paid_at >= datetime(month_start.year, month_start.month, 1, tzinfo=timezone.utc))
    )
    paid_this_month = res.scalar_one() or 0

    # MRR = active retainer engagements
    res = await db.execute(
        select(func.coalesce(func.sum(models.Engagement.retainer_amount_cents), 0))
        .where(
            models.Engagement.billing_type == models.BillingType.retainer,
            models.Engagement.status == models.EngagementStatus.active,
        )
    )
    mrr = res.scalar_one() or 0

    # Unbilled minutes
    res = await db.execute(
        select(func.coalesce(func.sum(models.TimeEntry.minutes), 0))
        .where(models.TimeEntry.billable.is_(True), models.TimeEntry.invoice_id.is_(None))
    )
    unbilled_minutes = res.scalar_one() or 0

    res = await db.execute(select(func.count()).select_from(models.Contact))
    contacts_count = res.scalar_one() or 0

    res = await db.execute(
        select(func.count()).select_from(models.Engagement).where(models.Engagement.status == models.EngagementStatus.active)
    )
    active_engagements = res.scalar_one() or 0

    # Overdue invoices (due date passed, not fully paid)
    res = await db.execute(
        select(models.Invoice)
        .options(selectinload(models.Invoice.line_items), selectinload(models.Invoice.payments))
        .where(
            models.Invoice.status.in_(unpaid_statuses),
            models.Invoice.due_date.is_not(None),
            models.Invoice.due_date < date.today(),
        )
        .order_by(models.Invoice.due_date)
    )
    overdue = res.scalars().all()
    cmap = await _contacts_map(db, [i.contact_id for i in overdue])
    for inv in overdue:
        c = cmap.get(inv.contact_id)
        inv.contact_name = c.name if c else None

    return schemas.CrmDashboard(
        pipeline_counts=pipeline_counts,
        pipeline_value_cents=pipeline_value,
        outstanding_ar_cents=outstanding_ar,
        paid_this_month_cents=paid_this_month,
        mrr_cents=mrr,
        unbilled_minutes=unbilled_minutes,
        contacts_count=contacts_count,
        active_engagements=active_engagements,
        overdue_invoices=[schemas.InvoiceResponse.model_validate(i) for i in overdue],
    )


# ══════════════════════════════════════════════════════════════════════════════
# Public (magic-link, no auth)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public/invoices/{token}", response_model=schemas.InvoicePublic)
async def public_invoice(token: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(models.Invoice).where(models.Invoice.public_token == token)
        .options(selectinload(models.Invoice.line_items))
    )
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    contact = await db.get(models.Contact, inv.contact_id) if inv.contact_id else None
    return schemas.InvoicePublic(
        number=inv.number, status=inv.status, issue_date=inv.issue_date, due_date=inv.due_date,
        currency=inv.currency, subtotal_cents=inv.subtotal_cents, tax_cents=inv.tax_cents,
        total_cents=inv.total_cents, amount_paid_cents=inv.amount_paid_cents, notes=inv.notes,
        line_items=[schemas.InvoiceLineItemResponse.model_validate(li) for li in inv.line_items],
        bill_to_name=contact.name if contact else None,
        bill_to_company=(contact.company_name if contact else None),
    )


async def _contract_public(db: AsyncSession, contract: models.Contract) -> schemas.ContractPublic:
    pub = schemas.ContractPublic.model_validate(contract)
    contact = await _contract_contact(db, contract)
    pub.client_name = (contact.company_name or contact.name) if contact else None
    return pub


async def _get_contract_by_token(db: AsyncSession, token: str) -> models.Contract:
    res = await db.execute(select(models.Contract).where(models.Contract.public_token == token))
    contract = res.scalars().first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    return contract


@router.get("/public/contracts/{token}", response_model=schemas.ContractPublic)
async def public_contract(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    contract = await _get_contract_by_token(db, token)
    # Log a "viewed" event, de-duplicated per IP per day.
    try:
        ip = get_client_ip(request)
        redis = get_redis()
        if await redis.set(f"crm:view:{token}:{ip}", "1", ex=86400, nx=True):
            await _log_contract(db, contract.id, "viewed", request)
            await db.commit()
    except Exception:
        await db.rollback()
    return await _contract_public(db, contract)


@router.get("/public/contracts/{token}/pdf")
async def public_contract_pdf(token: str, db: AsyncSession = Depends(get_db)):
    contract = await _get_contract_by_token(db, token)
    pdf = await _render_contract(db, contract)
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="{_slug(contract.title)}.pdf"'
    })


@router.get("/public/contracts/{token}/certificate", response_model=schemas.ContractCertificate)
async def public_contract_certificate(token: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(models.Contract).where(models.Contract.public_token == token)
        .options(selectinload(models.Contract.events))
    )
    contract = res.scalars().first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    contact = await _contract_contact(db, contract)
    events = sorted(contract.events, key=lambda e: e.occurred_at)
    return schemas.ContractCertificate(
        title=contract.title, document_sha256=contract.document_sha256,
        consultant_name=contract.consultant_signed_name or CONSULTANT_NAME,
        consultant_signed_at=contract.consultant_signed_at,
        client_name=(contact.company_name or contact.name) if contact else None,
        client_signed_at=contract.accepted_at, signer_email=contract.signer_email,
        status=contract.status,
        events=[schemas.ContractEventPublic.model_validate(e) for e in events],
    )


# ── Email OTP identity verification ──────────────────────────────────────────

def _otp_keys(token: str, email: str):
    e = email.strip().lower()
    return e, f"crm:otp:{token}:{e}", f"crm:otp:att:{token}:{e}", f"crm:otp:ok:{token}:{e}"


@router.post("/public/contracts/{token}/verify/start")
async def verify_start(token: str, payload: schemas.ContractVerifyStart, request: Request, db: AsyncSession = Depends(get_db)):
    contract = await _get_contract_by_token(db, token)
    if contract.status != models.ContractStatus.sent:
        raise HTTPException(400, "This contract is not open for signing")
    email = payload.email.strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address")

    redis = get_redis()
    ip = get_client_ip(request)
    ip_key = f"crm:otp:ip:{ip}"
    n = await redis.incr(ip_key)
    if n == 1:
        await redis.expire(ip_key, 900)
    if n > 8:
        raise HTTPException(429, "Too many attempts. Please try again later.")

    e, code_key, att_key, _ = _otp_keys(token, email)
    code = f"{secrets.randbelow(1000000):06d}"
    await redis.set(code_key, code, ex=OTP_TTL)
    await redis.delete(att_key)
    await send_contract_otp_email(email, code, contract.title)
    await _log_contract(db, contract.id, "otp_sent", request, actor_email=e)
    await db.commit()
    return {"ok": True}


@router.post("/public/contracts/{token}/verify/confirm")
async def verify_confirm(token: str, payload: schemas.ContractVerifyConfirm, request: Request, db: AsyncSession = Depends(get_db)):
    contract = await _get_contract_by_token(db, token)
    e, code_key, att_key, ok_key = _otp_keys(token, payload.email)
    redis = get_redis()

    attempts = await redis.incr(att_key)
    if attempts == 1:
        await redis.expire(att_key, OTP_TTL)
    if attempts > 6:
        await redis.delete(code_key)
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")

    stored = await redis.get(code_key)
    if not stored or stored != payload.code.strip():
        raise HTTPException(400, "Incorrect or expired code")

    await redis.delete(code_key, att_key)
    await redis.set(ok_key, "1", ex=OTP_VERIFIED_TTL)
    await _log_contract(db, contract.id, "email_verified", request, actor_email=e)
    await db.commit()
    return {"verified": True, "email": e}


@router.post("/public/contracts/{token}/accept", response_model=schemas.ContractPublic)
async def accept_contract(token: str, payload: schemas.ContractAccept, request: Request, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(models.Contract).where(models.Contract.public_token == token)
        .options(selectinload(models.Contract.engagement))
    )
    contract = res.scalars().first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status == models.ContractStatus.accepted:
        return await _contract_public(db, contract)
    if contract.status not in (models.ContractStatus.sent,):
        raise HTTPException(400, "This contract is not open for acceptance")

    # Require a verified email (identity assurance).
    e, _, _, ok_key = _otp_keys(token, payload.email)
    if not await get_redis().get(ok_key):
        raise HTTPException(403, "Please verify your email before signing")

    now = _now()
    contract.status = models.ContractStatus.accepted
    contract.accepted_at = now
    contract.accepted_name = payload.accepted_name
    contract.accepted_ip = get_client_ip(request)
    contract.signer_email = e
    contract.email_verified_at = now
    if not contract.consultant_signed_at:
        contract.consultant_signed_name = CONSULTANT_NAME
        contract.consultant_signed_at = now
    contract.updated_at = now

    await _log_contract(db, contract.id, "signed", request, actor_name=payload.accepted_name,
                        actor_email=e, meta={"party": "client"})
    if contract.engagement:
        await crm_utils.log_activity(
            db, contact_id=contract.engagement.contact_id, type=models.ActivityType.status_change,
            engagement_id=contract.engagement_id,
            body_md=f"Contract **{contract.title}** signed by {payload.accepted_name} ({e})",
        )

    # Tamper-evidence: fingerprint the content, then freeze the executed PDF
    # (with its certificate of completion) so it can never be silently re-generated.
    await db.flush()
    contact = await _contract_contact(db, contract)
    contract.document_sha256 = crm_utils.contract_fingerprint(contract, contact)
    ev_res = await db.execute(
        select(models.ContractEvent).where(models.ContractEvent.contract_id == contract.id)
        .order_by(models.ContractEvent.occurred_at)
    )
    events = ev_res.scalars().all()
    from app.crm_pdf import render_contract_pdf
    contract.executed_pdf = render_contract_pdf(contract, contact, events=events, doc_hash=contract.document_sha256)

    await db.commit()
    await db.refresh(contract)
    await get_redis().delete(ok_key)
    return await _contract_public(db, contract)
