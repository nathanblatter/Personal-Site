"""Unit tests for the voice-journal core logic that doesn't need a DB/MinIO/Redis:
the magic-link token round-trip + window enforcement, and the weave-response parser.
The full record→submit→transcribe→weave flow is integration-tested against a live stack.
"""
from datetime import date, timedelta

import pytest

from app.routers import journal
from app import prompt_service, weave_service


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


def test_backfill_two_weeks_ago_is_allowed():
    past = (date.today() - timedelta(days=14)).isoformat()
    assert journal.verify_journal_token(journal.sign_journal_token(past)) is not None


def test_old_unsubmitted_day_never_expires():
    # A day's link stays open indefinitely until submitted — no past expiry.
    old = (date.today() - timedelta(days=500)).isoformat()
    assert journal.verify_journal_token(journal.sign_journal_token(old)) is not None


# ── Day navigation ────────────────────────────────────────────────────────────

def test_day_nav_today_has_prev_but_no_future():
    html = journal._day_nav(date.today())
    assert "&larr;" in html          # previous day link present
    assert "&rarr;" not in html      # no navigating into the future


def test_day_nav_past_day_has_both_directions():
    html = journal._day_nav(date.today() - timedelta(days=3))
    assert "&larr;" in html and "&rarr;" in html


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
    # A memory is never lost to a bad parse; raw transcripts are preserved.
    assert "derrick" in out["narrative"]
    assert out["drift_score"] == 999.0


# ── Style: no em/en dashes, ever ──────────────────────────────────────────────

def test_narrative_has_no_em_or_en_dashes():
    out = weave_service._parse_response(
        '{"narrative": "It was good \\u2014 really good \\u2013 all day.", "drift_flags": []}',
        RAW,
    )
    assert "—" not in out["narrative"] and "–" not in out["narrative"]
    assert out["narrative"] == "It was good, really good, all day."


def test_strip_dashes_collapses_doubled_commas():
    assert weave_service._strip_dashes("a, — b") == "a, b"


def test_strip_spaced_hyphen_dash_substitute():
    assert weave_service._strip_dashes("great day - loved it") == "great day, loved it"
    # hyphenated compounds (no surrounding spaces) are untouched
    assert weave_service._strip_dashes("In-N-Out was well-known") == "In-N-Out was well-known"


# ── Name glossary flows into the weave prompt ─────────────────────────────────

def test_weave_prompt_includes_name_glossary():
    from app import journal_vocab
    assert "Jaxon" in weave_service.WEAVE_PROMPT
    assert "Lake Tulloch" in weave_service.WEAVE_PROMPT
    # canonical -> mis-hearing mapping is surfaced to the model
    assert "Jackson" in journal_vocab.weave_glossary()


# ── Next-day prompt suggestions ───────────────────────────────────────────────

D = date(2026, 7, 4)


def test_extract_parses_and_gates_by_confidence():
    js = ('{"prompts": ['
          '{"prompt_text": "How did the filling appointment go?", "target_date": "2026-07-05", "confidence": 0.9},'
          '{"prompt_text": "weak hypothetical", "confidence": 0.2}]}')
    out = prompt_service._parse_prompts(js, D)
    assert len(out) == 1                                  # low-confidence dropped
    assert out[0]["prompt_text"].startswith("How did the filling")
    assert out[0]["target_date"] == date(2026, 7, 5)


def test_extract_defaults_target_to_next_day():
    out = prompt_service._parse_prompts(
        '{"prompts": [{"prompt_text": "Anything come of it?", "confidence": 0.8}]}', D
    )
    assert out[0]["target_date"] == D + timedelta(days=1)


def test_extract_strips_em_dashes_from_prompt():
    out = prompt_service._parse_prompts(
        '{"prompts": [{"prompt_text": "The trip \\u2014 how was it?", "confidence": 0.8}]}', D
    )
    assert "—" not in out[0]["prompt_text"]


def test_extract_empty_on_garbage():
    assert prompt_service._parse_prompts("not json", D) == []


def test_fallback_prompt_from_bank():
    assert prompt_service.pick_fallback() in prompt_service.FALLBACK_PROMPTS


# ── Location label matching (haversine) ───────────────────────────────────────

_LABELS = [
    {"name": "Home", "lat": 40.2434, "lon": -111.6535, "radius_m": 100},
    {"name": "Gym", "lat": 37.7700, "lon": -121.9780, "radius_m": 150},
]


def test_point_inside_radius_matches_label():
    # A point right at Home plus one ~2m away both count as Home.
    visited = journal._match_visited([(40.2434, -111.6535), (40.24342, -111.6535)], _LABELS)
    assert visited == ["Home"]


def test_point_outside_all_radii_matches_nothing():
    assert journal._match_visited([(34.0, -118.0)], _LABELS) == []


def test_visited_ordered_by_dwell():
    # Two points at Gym, one at Home -> Gym ranked first (more dwell).
    pts = [(37.7700, -121.9780), (37.7700, -121.9780), (40.2434, -111.6535)]
    assert journal._match_visited(pts, _LABELS) == ["Gym", "Home"]
