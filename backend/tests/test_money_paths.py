"""Unit tests for the money-path core logic: invoice totals + contract integrity.

These cover the pure, business-critical computations (invoice subtotal/total/paid
status reconciliation, and the tamper-evidence contract fingerprint) without
needing a database, Zoom, or email. The full HTTP flows are integration-tested
separately against a live stack.
"""
import re
from types import SimpleNamespace

from app import crm_utils, models


# ── Invoice totals ────────────────────────────────────────────────────────────

def make_invoice(line_amounts, tax=0, paid=0, status=models.InvoiceStatus.sent):
    return SimpleNamespace(
        line_items=[SimpleNamespace(amount_cents=a) for a in line_amounts],
        tax_cents=tax,
        amount_paid_cents=paid,
        status=status,
        subtotal_cents=0,
        total_cents=0,
    )


def test_subtotal_and_total_with_tax():
    inv = make_invoice([1000, 2500], tax=350)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.subtotal_cents == 3500
    assert inv.total_cents == 3850


def test_full_payment_marks_paid():
    inv = make_invoice([5000], paid=5000, status=models.InvoiceStatus.sent)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.status == models.InvoiceStatus.paid


def test_partial_payment_marks_partial():
    inv = make_invoice([5000], paid=2000, status=models.InvoiceStatus.sent)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.status == models.InvoiceStatus.partial


def test_overpayment_marks_paid():
    inv = make_invoice([5000], paid=6000, status=models.InvoiceStatus.overdue)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.status == models.InvoiceStatus.paid


def test_draft_status_is_never_auto_advanced():
    inv = make_invoice([5000], paid=5000, status=models.InvoiceStatus.draft)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.status == models.InvoiceStatus.draft


def test_void_status_is_never_auto_advanced():
    inv = make_invoice([5000], paid=5000, status=models.InvoiceStatus.void)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.status == models.InvoiceStatus.void


def test_zero_total_with_no_payment_unchanged():
    inv = make_invoice([], paid=0, status=models.InvoiceStatus.sent)
    crm_utils.recalc_invoice_totals(inv)
    assert inv.total_cents == 0
    assert inv.status == models.InvoiceStatus.sent


# ── Contract fingerprint (tamper evidence) ─────────────────────────────────────

def make_contract(**kw):
    defaults = dict(
        title="Engagement", scope_md="scope", terms_md="terms",
        total_value_cents=100000, currency="USD", start_date=None, end_date=None,
        consultant_signed_name=None, consultant_signed_at=None,
        accepted_name=None, accepted_at=None, signer_email=None,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def test_fingerprint_is_deterministic():
    c = make_contract()
    assert crm_utils.contract_fingerprint(c) == crm_utils.contract_fingerprint(c)


def test_fingerprint_is_sha256_hex():
    fp = crm_utils.contract_fingerprint(make_contract())
    assert re.fullmatch(r"[0-9a-f]{64}", fp)


def test_fingerprint_changes_when_terms_change():
    a = crm_utils.contract_fingerprint(make_contract(terms_md="v1"))
    b = crm_utils.contract_fingerprint(make_contract(terms_md="v2"))
    assert a != b


def test_fingerprint_changes_when_value_changes():
    a = crm_utils.contract_fingerprint(make_contract(total_value_cents=100000))
    b = crm_utils.contract_fingerprint(make_contract(total_value_cents=200000))
    assert a != b


def test_fingerprint_signer_email_is_case_insensitive():
    a = crm_utils.contract_fingerprint(make_contract(signer_email="A@Example.com"))
    b = crm_utils.contract_fingerprint(make_contract(signer_email="a@example.com"))
    assert a == b


def test_fingerprint_incorporates_contact():
    c = make_contract()
    contact = SimpleNamespace(company_name="Acme Co", name="Bob")
    assert crm_utils.contract_fingerprint(c, contact) != crm_utils.contract_fingerprint(c)
