"""Stripe invoice payments: the pure pieces of app/stripe_service.py plus the webhook route.

The event fixture is a trimmed copy of a real `invoice.paid` from the test sandbox
(API version 2026-11-18.endive), so parse_paid_event is checked against Stripe's shape,
not against my memory of it. The live create/reuse/void/pay round trip was run against
the sandbox by hand; these tests never touch the network.
"""
import asyncio
import hashlib
import hmac
import json
import time
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import models, stripe_service

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "stripe_invoice_paid.json").read_text())


def make_invoice(lines=(150000, 2500), tax=0, paid=0, status=models.InvoiceStatus.sent, currency="USD"):
    total = sum(lines) + tax
    return SimpleNamespace(
        id="00000000-0000-0000-0000-0000000000a2", number="INV-0007", status=status, currency=currency,
        total_cents=total, amount_paid_cents=paid, tax_cents=tax, due_date=date(2026, 12, 5),
        stripe_invoice_id=None,
        line_items=[SimpleNamespace(description=f"Line {i}", quantity=1, amount_cents=a, sort_order=i)
                    for i, a in enumerate(lines)],
    )


# ── What may be paid online ────────────────────────────────────────────────────

@pytest.mark.parametrize("status, expected", [
    (models.InvoiceStatus.sent, True),
    (models.InvoiceStatus.partial, True),
    (models.InvoiceStatus.overdue, True),
    (models.InvoiceStatus.draft, False),
    (models.InvoiceStatus.void, False),
    (models.InvoiceStatus.paid, False),
])
def test_only_sent_unpaid_invoices_are_payable(status, expected):
    assert stripe_service.payable(make_invoice(status=status)) is expected


def test_nothing_left_to_pay_is_not_payable():
    assert not stripe_service.payable(make_invoice(lines=(5000,), paid=5000))


def test_non_usd_invoices_are_not_payable_online():
    assert not stripe_service.payable(make_invoice(currency="EUR"))


# ── The Stripe invoice reproduces the CRM balance ─────────────────────────────

def test_items_sum_to_the_balance_after_tax_and_a_manual_payment():
    inv = make_invoice(lines=(150000, 2500), tax=1200, paid=50000)
    items = stripe_service.invoice_items(inv)
    assert sum(i["amount"] for i in items) == stripe_service.balance_cents(inv) == 103700
    assert items[-1] == {"description": "Payments already received", "amount": -50000}
    assert {"description": "Tax", "amount": 1200} in items


def test_quantity_shows_in_the_line_description_and_zero_lines_are_dropped():
    inv = make_invoice(lines=(150000, 0))
    inv.line_items[0].quantity = 10
    items = stripe_service.invoice_items(inv)
    assert items == [{"description": "Line 0 (x10)", "amount": 150000}]


def test_an_open_stripe_invoice_is_reused_only_while_it_matches_the_balance():
    inv = make_invoice()
    stripe_inv = {"status": "open", "amount_remaining": 152500, "metadata": {"crm_invoice_id": inv.id}}
    assert stripe_service.matches(stripe_inv, inv)
    inv.amount_paid_cents = 50000  # a Venmo payment was recorded in the CRM since
    assert not stripe_service.matches(stripe_inv, inv)
    assert not stripe_service.matches({**stripe_inv, "status": "void"}, make_invoice())
    assert not stripe_service.matches({**stripe_inv, "metadata": {"crm_invoice_id": "someone-else"}}, make_invoice())
    assert not stripe_service.matches(None, inv)


def test_form_encoding_matches_stripes_bracket_style():
    pairs = stripe_service._flatten({"customer": "cus_1", "auto_advance": False, "due_date": None,
                                     "metadata": {"crm_invoice_id": "x"}, "expand": ["lines"]})
    assert pairs == [("customer", "cus_1"), ("auto_advance", "false"),
                     ("metadata[crm_invoice_id]", "x"), ("expand[0]", "lines")]


# ── Webhook parsing and signatures ────────────────────────────────────────────

def test_real_invoice_paid_event_is_parsed():
    paid = stripe_service.parse_paid_event(FIXTURE)
    assert paid.stripe_invoice_id == FIXTURE["data"]["object"]["id"]
    assert paid.crm_invoice_id == "00000000-0000-0000-0000-0000000000a2"
    assert paid.amount_cents == 102500
    assert paid.paid_at == FIXTURE["data"]["object"]["status_transitions"]["paid_at"]


def test_events_that_are_not_ours_are_ignored():
    other = json.loads(json.dumps(FIXTURE))
    other["data"]["object"]["metadata"] = {}
    assert stripe_service.parse_paid_event(other) is None
    assert stripe_service.parse_paid_event({**FIXTURE, "type": "invoice.finalized"}) is None


def sign(payload: bytes, secret: str, ts: int) -> str:
    mac = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={mac}"


def test_signature_accepts_stripes_scheme_and_rejects_tampering_and_replays():
    body, secret, now = b'{"id":"evt_1"}', "whsec_test", 1_800_000_000
    header = sign(body, secret, now)
    assert stripe_service.verify_signature(body, header, secret, now=now)
    assert stripe_service.verify_signature(body, "v1=bogus," + header, secret, now=now)  # rotated secrets: any v1
    assert not stripe_service.verify_signature(body + b" ", header, secret, now=now)
    assert not stripe_service.verify_signature(body, header, "whsec_other", now=now)
    assert not stripe_service.verify_signature(body, header, secret, now=now + 301)
    assert not stripe_service.verify_signature(body, "", secret, now=now)
    assert not stripe_service.verify_signature(body, header, "", now=now)
    assert not stripe_service.verify_signature(body, "t=notanumber,v1=x", secret, now=now)


# ── Webhook → CRM: one payment, recorded once ─────────────────────────────────

class FakeDB:
    def __init__(self, invoice):
        self.invoice = invoice
        self.added = []
        self.commits = 0

    async def get(self, model, key, options=None):
        return self.invoice if (model is models.Invoice and key == self.invoice.id) else None

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, models.Payment):
            self.invoice.payments.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.commits += 1


def crm_invoice(paid=0):
    inv = make_invoice(lines=(150000, 2500), paid=paid)
    inv.payments, inv.contact_id, inv.engagement_id, inv.paid_at, inv.updated_at = [], None, "eng", None, None
    return inv


def test_paid_event_records_one_stripe_payment_and_marks_the_invoice_paid():
    from app.routers import crm

    inv = crm_invoice(paid=50000)  # Venmo first, the rest online
    db = FakeDB(inv)
    paid = stripe_service.parse_paid_event(FIXTURE)
    assert asyncio.run(crm.record_stripe_payment(db, paid)) == "recorded"
    assert inv.amount_paid_cents == 152500 and inv.status == models.InvoiceStatus.paid and inv.paid_at
    [payment] = [a for a in db.added if isinstance(a, models.Payment)]
    assert payment.method == models.PaymentMethod.stripe and payment.reference == paid.stripe_invoice_id
    # Stripe retries webhooks: the same event must not pay the invoice twice.
    assert asyncio.run(crm.record_stripe_payment(db, paid)) == "duplicate"
    assert inv.amount_paid_cents == 152500 and db.commits == 1


def test_webhook_route_rejects_unsigned_requests_and_accepts_signed_ones(monkeypatch):
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import app
    from app.routers import crm

    secret = "whsec_unit"
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", secret)
    seen = []

    async def fake_record(db, paid):
        seen.append(paid)
        return "recorded"

    async def no_alert(message):
        return None

    monkeypatch.setattr(crm, "record_stripe_payment", fake_record)
    monkeypatch.setattr(crm, "send_alert", no_alert)
    app.dependency_overrides[get_db] = lambda: None
    try:
        client = TestClient(app)
        body = json.dumps(FIXTURE).encode()
        url = "/api/v1/crm/stripe/webhook"
        assert client.post(url, content=body).status_code == 400
        bad = sign(body, "whsec_wrong", int(time.time()))
        assert client.post(url, content=body, headers={"Stripe-Signature": bad}).status_code == 400
        good = sign(body, secret, int(time.time()))
        resp = client.post(url, content=body, headers={"Stripe-Signature": good})
        assert resp.status_code == 200 and resp.json()["outcome"] == "recorded"
        assert seen and seen[0].amount_cents == 102500
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_the_public_invoice_response_carries_the_pay_flag_and_contracts_do_not():
    # Regression: the flag was first added to ContractPublic by mistake, so the Pay button never showed.
    from app import schemas

    assert "pay_online" in schemas.InvoicePublic.model_fields
    assert "pay_online" not in schemas.ContractPublic.model_fields


def test_due_date_is_noon_utc_so_stripe_shows_the_same_day_and_past_dates_are_dropped():
    from datetime import datetime, timezone

    ts = stripe_service.due_timestamp(date(2026, 12, 9), now=0)
    assert datetime.fromtimestamp(ts, tz=timezone.utc) == datetime(2026, 12, 9, 12, tzinfo=timezone.utc)
    assert stripe_service.due_timestamp(date(2020, 1, 1)) is None
    assert stripe_service.due_timestamp(None) is None
