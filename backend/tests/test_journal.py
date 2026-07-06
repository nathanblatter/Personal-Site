"""Unit tests for the voice-journal core logic that doesn't need a DB/MinIO/Redis:
the magic-link token round-trip + window enforcement, and the weave-response parser.
The full record→submit→transcribe→weave flow is integration-tested against a live stack.
"""
from datetime import date, timedelta

import pytest

from app.routers import journal
from app import weave_service


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    # sign/verify read the module-level secret; set a stable test value.
    monkeypatch.setattr(journal, "JOURNAL_LINK_SECRET", "test-secret")


# ── Magic-link token ────────────────────────────────────────────────────────

def test_token_round_trips_todays_date():
    today = date.today()
    token = journal.sign_journal_token(today.isoformat())
    assert journal.verify_journal_token(token) == today


def test_tampered_token_is_rejected():
    token = journal.sign_journal_token(date.today().isoformat())
    payload, sig = token.split(".", 1)
    assert journal.verify_journal_token(f"{payload}.{sig}x") is None


def test_far_future_date_is_rejected():
    future = (date.today() + timedelta(days=5)).isoformat()
    assert journal.verify_journal_token(journal.sign_journal_token(future)) is None


def test_backfill_within_window_is_allowed():
    # Two weeks ago should still open for backfill (window is ~a year).
    past = (date.today() - timedelta(days=14)).isoformat()
    assert journal.verify_journal_token(journal.sign_journal_token(past)) is not None


def test_date_older_than_window_is_rejected():
    old = (date.today() - timedelta(days=journal.JOURNAL_MAX_PAST_DAYS + 5)).isoformat()
    assert journal.verify_journal_token(journal.sign_journal_token(old)) is None


def test_verify_returns_none_without_secret(monkeypatch):
    monkeypatch.setattr(journal, "JOURNAL_LINK_SECRET", "")
    # Signing with empty secret then verifying must fail closed.
    token = journal.sign_journal_token(date.today().isoformat())
    assert journal.verify_journal_token(token) is None


# ── Weave response parsing ────────────────────────────────────────────────────

RAW = ["talked to derrick about the offer", "went for a run at the lake"]


def test_parse_plain_json_counts_content_drift():
    out = weave_service._parse_response(
        '{"narrative": "A good day.", "drift_flags": ['
        '{"category": "structural", "note": "reordered"},'
        '{"category": "content", "note": "dropped a hedge"}]}',
        RAW,
    )
    assert out["narrative"] == "A good day."
    assert out["drift_score"] == 1.0  # only the content flag counts


def test_parse_strips_code_fences():
    out = weave_service._parse_response(
        '```json\n{"narrative": "Fenced.", "drift_flags": []}\n```', RAW
    )
    assert out["narrative"] == "Fenced."
    assert out["drift_score"] == 0.0


def test_parse_falls_back_to_raw_on_garbage():
    out = weave_service._parse_response("not json at all", RAW)
    # A memory is never lost to a bad parse — raw transcripts are preserved.
    assert "derrick" in out["narrative"]
    assert out["drift_score"] == 999.0
