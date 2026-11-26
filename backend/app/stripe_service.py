"""Stripe for CRM invoices: the CRM stays the source of truth, Stripe only collects.

Flow (from Stripe's implementation planner, guide iguide_61VpGeV1VEYw7Ao6X41KFRLWSAwae):
- A client opens their invoice magic link and taps "Pay online". The site makes sure a
  finalized Stripe invoice exists for the CRM invoice's *current balance* and redirects to
  Stripe's Hosted Invoice Page (cards, bank debit, 3DS all handled there). The hosted URL
  is short-lived, so it is fetched fresh on every click, never emailed.
- If the CRM invoice changed since (line items edited, a manual Venmo payment recorded),
  the old Stripe invoice no longer matches the balance: it is voided and a new one made.
- Stripe tells us the outcome by webhook. `invoice.paid` records a Payment(method=stripe)
  on the CRM invoice exactly once (the Stripe invoice id is the payment reference).

Plain httpx against the REST API instead of the SDK: four endpoints and an HMAC check do
not justify a dependency that changes shape every major version. Everything is off unless
STRIPE_SECRET_KEY is set, so local dev and an unconfigured prod behave exactly as before.

Stripe never emails the client (auto_advance off, collection_method send_invoice and the
invoice is never "sent" through Stripe): the CRM already emails its own invoice link.
"""
from __future__ import annotations

import calendar
import hashlib
import hmac
import logging
import os
import time
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

log = logging.getLogger(__name__)

API = "https://api.stripe.com/v1"
# Pinned so webhook payloads and responses keep one shape regardless of the account default.
API_VERSION = os.getenv("STRIPE_API_VERSION", "2026-11-18.endive")
WEBHOOK_TOLERANCE_S = 300


def _secret_key() -> str:
    return os.getenv("STRIPE_SECRET_KEY", "").strip()


def webhook_secret() -> str:
    return os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()


def enabled() -> bool:
    return bool(_secret_key())


class StripeError(Exception):
    pass


def _flatten(data: dict[str, Any], prefix: str = "") -> list[tuple[str, str]]:
    """Stripe's form encoding: nested dicts become a[b]=..., lists a[0]=..."""
    out: list[tuple[str, str]] = []
    for key, value in data.items():
        name = f"{prefix}[{key}]" if prefix else key
        if value is None:
            continue
        if isinstance(value, dict):
            out.extend(_flatten(value, name))
        elif isinstance(value, (list, tuple)):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    out.extend(_flatten(item, f"{name}[{i}]"))
                else:
                    out.append((f"{name}[{i}]", str(item)))
        elif isinstance(value, bool):
            out.append((name, "true" if value else "false"))
        else:
            out.append((name, str(value)))
    return out


async def _call(method: str, path: str, data: Optional[dict] = None, *, idempotency_key: Optional[str] = None,
                client: Optional[httpx.AsyncClient] = None) -> dict:
    headers = {"Stripe-Version": API_VERSION}
    pairs = _flatten(data or {})
    body = urlencode(pairs) if method != "GET" else None
    if body is not None:
        # Encoded by hand: httpx 0.27 treats a list of pairs passed as data= as a sync stream.
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    own = client is None
    client = client or httpx.AsyncClient(timeout=20)
    try:
        resp = await client.request(
            method, f"{API}{path}", auth=(_secret_key(), ""), headers=headers,
            content=body, params=pairs if method == "GET" else None,
        )
    finally:
        if own:
            await client.aclose()
    result = resp.json()
    if resp.status_code >= 400:
        err = result.get("error") or {}
        raise StripeError(f"{err.get('type', 'error')}: {err.get('message', resp.text[:200])}")
    return result


# ── Pure pieces (unit-tested) ──────────────────────────────────────────────────

def balance_cents(inv) -> int:
    return max((inv.total_cents or 0) - (inv.amount_paid_cents or 0), 0)


def payable(inv) -> bool:
    """Whether a client may pay this CRM invoice online right now."""
    status = getattr(inv.status, "value", inv.status)
    return status in ("sent", "partial", "overdue") and balance_cents(inv) > 0 and (inv.currency or "USD").upper() == "USD"


def invoice_items(inv) -> list[dict]:
    """The Stripe invoice items that reproduce the CRM invoice's balance.

    One item per CRM line (so the hosted page reads like the CRM invoice), a tax line if
    the CRM invoice carries tax, and a negative credit for anything already paid by hand.
    Their sum is exactly balance_cents(inv).
    """
    items = [
        {"description": f"{li.description} (x{li.quantity})" if float(li.quantity or 1) != 1 else li.description,
         "amount": int(li.amount_cents)}
        for li in sorted(inv.line_items, key=lambda li: li.sort_order or 0)
        if int(li.amount_cents or 0) != 0
    ]
    if inv.tax_cents:
        items.append({"description": "Tax", "amount": int(inv.tax_cents)})
    if inv.amount_paid_cents:
        items.append({"description": "Payments already received", "amount": -int(inv.amount_paid_cents)})
    return items


def due_timestamp(due: Optional[date], *, now: Optional[float] = None) -> Optional[int]:
    """Stripe wants a timestamp; Stripe shows it as a date in the account's timezone.

    Noon UTC on the due date is the same calendar day in every US timezone (it was a day
    late when built from local midnight + 23h). Past dates return None (Stripe rejects them;
    the caller falls back to days_until_due).
    """
    if not due:
        return None
    ts = calendar.timegm(due.timetuple()) + 12 * 3600
    return ts if ts > (now if now is not None else time.time()) else None


def matches(stripe_invoice: Optional[dict], inv) -> bool:
    """Can this existing Stripe invoice still be used to collect the CRM balance?"""
    if not stripe_invoice:
        return False
    return (stripe_invoice.get("status") == "open"
            and int(stripe_invoice.get("amount_remaining", -1)) == balance_cents(inv)
            and (stripe_invoice.get("metadata") or {}).get("crm_invoice_id") == str(inv.id))


@dataclass
class PaidEvent:
    stripe_invoice_id: str
    crm_invoice_id: str
    amount_cents: int
    paid_at: int


def parse_paid_event(event: dict) -> Optional[PaidEvent]:
    """Pull what the CRM needs out of an invoice.paid event, or None if it isn't ours."""
    if event.get("type") != "invoice.paid":
        return None
    obj = (event.get("data") or {}).get("object") or {}
    crm_id = (obj.get("metadata") or {}).get("crm_invoice_id")
    if obj.get("object") != "invoice" or not crm_id:
        return None
    transitions = obj.get("status_transitions") or {}
    return PaidEvent(
        stripe_invoice_id=obj["id"],
        crm_invoice_id=crm_id,
        amount_cents=int(obj.get("amount_paid") or 0),
        paid_at=int(transitions.get("paid_at") or event.get("created") or time.time()),
    )


def verify_signature(payload: bytes, header: str, secret: str, *, now: Optional[float] = None,
                     tolerance: int = WEBHOOK_TOLERANCE_S) -> bool:
    """Stripe-Signature check: t=<ts>,v1=<hmac-sha256(secret, f"{t}.{payload}")>, within tolerance."""
    if not (secret and header):
        return False
    parts: dict[str, list[str]] = {}
    for piece in header.split(","):
        key, _, value = piece.strip().partition("=")
        parts.setdefault(key, []).append(value)
    try:
        ts = int(parts.get("t", [""])[0])
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - ts) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in parts.get("v1", []))


# ── Calls to Stripe ────────────────────────────────────────────────────────────

async def ensure_customer(contact, *, client: Optional[httpx.AsyncClient] = None) -> str:
    """The contact's Stripe customer id, creating the customer the first time."""
    if getattr(contact, "stripe_customer_id", None):
        return contact.stripe_customer_id
    data = {"email": contact.email, "name": contact.company_name or contact.name,
            "metadata": {"crm_contact_id": str(contact.id)}}
    cust = await _call("POST", "/customers", data, idempotency_key=f"crm-contact-{contact.id}", client=client)
    return cust["id"]


async def hosted_invoice_url(inv, contact, *, client: Optional[httpx.AsyncClient] = None) -> tuple[str, str, str]:
    """Return (hosted_invoice_url, stripe_invoice_id, stripe_customer_id) for the CRM balance.

    Reuses the existing Stripe invoice when it still matches; otherwise voids it and makes a
    fresh one. The caller stores the two ids on the CRM records.
    """
    customer_id = await ensure_customer(contact, client=client)
    current = None
    if inv.stripe_invoice_id:
        current = await _call("GET", f"/invoices/{inv.stripe_invoice_id}", client=client)
        if matches(current, inv):
            return current["hosted_invoice_url"], current["id"], customer_id
        if current.get("status") == "paid":
            # Paid on Stripe but the webhook hasn't landed yet: show the receipt, never a second bill.
            return current["hosted_invoice_url"], current["id"], customer_id
        if current.get("status") == "open":
            await _call("POST", f"/invoices/{current['id']}/void", client=client)
        elif current.get("status") == "draft":
            await _call("DELETE", f"/invoices/{current['id']}", client=client)

    # A key per (CRM invoice, balance, replaced Stripe invoice) makes retries safe without
    # ever reusing a key for a different amount.
    key = f"crm-inv-{inv.id}-{balance_cents(inv)}-{inv.stripe_invoice_id or 'first'}"
    due_ts = due_timestamp(inv.due_date)
    draft = await _call("POST", "/invoices", {
        "customer": customer_id,
        "collection_method": "send_invoice",
        "auto_advance": False,
        "currency": "usd",
        "pending_invoice_items_behavior": "exclude",
        "due_date": due_ts,
        "days_until_due": None if due_ts else 14,
        "description": f"Invoice {inv.number} from Nathan Blatter",
        "metadata": {"crm_invoice_id": str(inv.id), "crm_invoice_number": inv.number},
    }, idempotency_key=f"{key}-invoice", client=client)
    for i, item in enumerate(invoice_items(inv)):
        await _call("POST", "/invoiceitems", {
            "customer": customer_id, "invoice": draft["id"], "currency": "usd",
            "amount": item["amount"], "description": item["description"],
        }, idempotency_key=f"{key}-item-{i}", client=client)
    final = await _call("POST", f"/invoices/{draft['id']}/finalize", {"auto_advance": False},
                        idempotency_key=f"{key}-finalize", client=client)
    if int(final.get("amount_remaining", -1)) != balance_cents(inv):
        raise StripeError(f"Stripe invoice {final['id']} totals {final.get('amount_remaining')}, "
                          f"expected {balance_cents(inv)}")
    return final["hosted_invoice_url"], final["id"], customer_id
