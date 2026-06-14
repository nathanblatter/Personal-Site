"""Shared helpers for the consulting CRM.

Central place for contact de-duplication, invoice numbering, magic-link tokens,
and building invoices from engagements (hourly / fixed / retainer).
"""
import hashlib
import json
import secrets
from datetime import datetime, timezone, date
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def _now() -> datetime:
    return datetime.now(timezone.utc)


def make_public_token() -> str:
    """Long-lived, revocable token for client magic links."""
    return secrets.token_urlsafe(24)


async def upsert_contact_by_email(
    db: AsyncSession,
    *,
    email: Optional[str],
    name: str,
    source: models.ContactSource,
    phone: Optional[str] = None,
    title: Optional[str] = None,
    company_name: Optional[str] = None,
    notes: Optional[str] = None,
) -> models.Contact:
    """Find a contact by case-insensitive email, or create one.

    Used by the contact form, bookings, and testimonial requests so every
    inbound person lands in a single de-duplicated Contact record. Existing
    contacts keep their data; only empty fields are backfilled.

    Does NOT commit — the caller owns the transaction. The returned Contact is
    flushed so its id is available.
    """
    contact: Optional[models.Contact] = None
    if email:
        result = await db.execute(
            select(models.Contact).where(func.lower(models.Contact.email) == email.lower())
        )
        contact = result.scalars().first()

    now = _now()
    if contact is None:
        contact = models.Contact(
            name=name,
            email=email,
            phone=phone,
            title=title,
            company_name=company_name,
            source=source,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        db.add(contact)
    else:
        # Backfill only empty fields; never clobber existing data.
        if not contact.name and name:
            contact.name = name
        if not contact.phone and phone:
            contact.phone = phone
        if not contact.title and title:
            contact.title = title
        if not contact.company_name and company_name:
            contact.company_name = company_name
        contact.updated_at = now

    await db.flush()
    return contact


async def log_activity(
    db: AsyncSession,
    *,
    contact_id: str,
    type: models.ActivityType,
    body_md: Optional[str] = None,
    engagement_id: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
) -> models.Activity:
    """Append an item to a contact's timeline. Does not commit."""
    now = _now()
    activity = models.Activity(
        contact_id=contact_id,
        engagement_id=engagement_id,
        type=type,
        body_md=body_md,
        occurred_at=occurred_at or now,
        created_at=now,
    )
    db.add(activity)
    await db.flush()
    return activity


async def next_invoice_number(db: AsyncSession) -> str:
    """Sequential invoice number scoped to the current year: INV-2026-0007.

    Computed from the count of existing invoices for the year. The `number`
    column is unique-constrained as a safety net against races.
    """
    year = date.today().year
    prefix = f"INV-{year}-"
    result = await db.execute(
        select(func.count())
        .select_from(models.Invoice)
        .where(models.Invoice.number.like(f"{prefix}%"))
    )
    count = result.scalar_one() or 0
    return f"{prefix}{count + 1:04d}"


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def contract_fingerprint(contract: models.Contract, contact=None) -> str:
    """Deterministic SHA-256 over the agreement's binding content + signatures.

    Re-computing this from the DB later and comparing against the stored value
    detects any post-execution tampering with terms, parties, or signatures.
    Hashes content (not PDF bytes), so it is reproducible.
    """
    payload = {
        "title": contract.title or "",
        "scope": contract.scope_md or "",
        "terms": contract.terms_md or "",
        "value_cents": contract.total_value_cents,
        "currency": contract.currency,
        "start_date": str(contract.start_date) if contract.start_date else None,
        "end_date": str(contract.end_date) if contract.end_date else None,
        "consultant_name": contract.consultant_signed_name,
        "consultant_signed_at": _iso(contract.consultant_signed_at),
        "client_name": contract.accepted_name,
        "client_signed_at": _iso(contract.accepted_at),
        "signer_email": (contract.signer_email or "").lower(),
        "client": (contact.company_name or contact.name) if contact else None,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def log_contract_event(
    db: AsyncSession,
    *,
    contract_id: str,
    type: str,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    meta: Optional[dict] = None,
) -> models.ContractEvent:
    """Append an immutable audit-trail entry. Does not commit."""
    ev = models.ContractEvent(
        contract_id=contract_id, type=type, actor_name=actor_name, actor_email=actor_email,
        ip=ip, user_agent=(user_agent or "")[:500] or None, meta=meta, occurred_at=_now(),
    )
    db.add(ev)
    await db.flush()
    return ev


def recalc_invoice_totals(invoice: models.Invoice) -> None:
    """Recompute subtotal/total from line items and reconcile paid status."""
    subtotal = sum(li.amount_cents for li in invoice.line_items)
    invoice.subtotal_cents = subtotal
    invoice.total_cents = subtotal + (invoice.tax_cents or 0)
    paid = invoice.amount_paid_cents or 0
    if invoice.status not in (models.InvoiceStatus.void, models.InvoiceStatus.draft):
        if paid >= invoice.total_cents and invoice.total_cents > 0:
            invoice.status = models.InvoiceStatus.paid
        elif paid > 0:
            invoice.status = models.InvoiceStatus.partial
