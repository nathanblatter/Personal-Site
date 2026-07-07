"""Next-day prompt suggestions.

Two sources, both surfaced (gently) on the nightly journal text:
  - content-derived: after the weave, extract forward-looking plans / open threads
    from the day's narrative, tagged to the day they're relevant for.
  - location-derived: from the labeled places the person visited that day.
Plus a fallback bank so the nudge is never silent, and never forced homework.

Framing rule (PRD): "something you could talk about", never "did you do X".
"""

import json
import logging
import random
import re
from datetime import date as date_type, timedelta
from typing import Optional

from app import weave_service

log = logging.getLogger("prompts")

# Only clear, stated intentions become content prompts.
CONFIDENCE_MIN = 0.6

_EXTRACT_SYSTEM = """You are given a personal journal entry and its date. Find forward-looking plans, appointments, or unresolved threads the person clearly stated are coming up or that they intend to follow through on (e.g. "filling appointment tomorrow", "talking to Derrick about the offer next week").

Rules:
- Only include CLEAR stated intentions or scheduled things, never speculative/hypothetical language ("I could maybe talk to him" is NOT a plan; "I'm talking to him tomorrow" is).
- For each, write a short, gentle journaling prompt phrased as an invitation to reflect, e.g. "How did the filling appointment go?" or "Anything come of the conversation with Derrick?". Never phrase it as "did you do X" or as pressure/homework.
- Infer the date each is relevant for and return it as target_date (YYYY-MM-DD). If unsure, use the day after the entry date.
- Never use em dashes or en dashes.

Return ONLY valid JSON, no prose outside it:
{"prompts": [{"prompt_text": "...", "target_date": "YYYY-MM-DD", "confidence": 0.0-1.0}]}
Return an empty array if there are no clear forward-looking items."""

_LOCATION_SYSTEM = """You're told the date and which of the person's saved places they spent time at today. Write ONE short, casual journaling prompt inviting them to talk about their time at the most interesting of those places.

Rules:
- Phrase it as a friendly invitation, not an interrogation, and keep it specific to what the place IS (a gym -> the workout; work -> the workday; a family cabin/home -> who they saw and the time together).
- Do NOT invent or assume specific activities you have no evidence for, especially season- or weather-dependent ones. It is a factual error to suggest skiing/the slopes in summer, or the lake/swimming in winter. Use the date to stay season-appropriate, and when unsure just ask openly what they got up to.
- Never use em dashes. Return only the prompt text, with no quotes and no preamble."""

FALLBACK_PROMPTS = [
    "What stood out about today?",
    "Anything today you want to remember a year from now?",
    "Who did you spend time with today, and how was it?",
    "What is something small that made today good or hard?",
    "What is on your mind tonight?",
]


def pick_fallback() -> str:
    return random.choice(FALLBACK_PROMPTS)


def _parse_prompts(text: str, entry_date: date_type) -> list[dict]:
    """Parse the extractor's JSON into [{prompt_text, target_date, confidence}].
    Applies the confidence gate and defaults target_date to entry_date + 1."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        data = json.loads(m.group(0) if m else cleaned)
        raw = data.get("prompts") or []
    except Exception as exc:
        log.warning("prompt extraction parse failed: %s", exc)
        return []
    default_target = entry_date + timedelta(days=1)
    out = []
    for p in raw:
        if not isinstance(p, dict):
            continue
        ptext = (p.get("prompt_text") or "").strip()
        conf = float(p.get("confidence") or 0.0)
        if not ptext or conf < CONFIDENCE_MIN:
            continue
        try:
            target = date_type.fromisoformat(p.get("target_date", ""))
        except (ValueError, TypeError):
            target = default_target
        out.append({
            "prompt_text": weave_service._strip_dashes(ptext),
            "target_date": target,
            "confidence": conf,
        })
    return out


async def extract_forward_prompts(narrative: str, entry_date: date_type) -> list[dict]:
    """LLM pass over a day's narrative -> confidence-gated content prompts."""
    if not narrative or not narrative.strip():
        return []
    user = f"Entry date: {entry_date.isoformat()}\n\nEntry:\n{narrative}"
    try:
        text = await weave_service.call_llm(_EXTRACT_SYSTEM, user, max_tokens=1024)
    except Exception:
        log.exception("prompt extraction LLM call failed")
        return []
    return _parse_prompts(text, entry_date)


async def location_prompt(visited_labels: list[str], day: Optional[date_type] = None) -> Optional[str]:
    """Craft one gentle, season-aware prompt from the labeled places visited, or None."""
    if not visited_labels:
        return None
    when = (day or date_type.today())
    user = f"Date: {when.strftime('%A, %B %-d, %Y')}\nPlaces today: " + "; ".join(visited_labels)
    try:
        text = await weave_service.call_llm(_LOCATION_SYSTEM, user, max_tokens=200, want_json=False)
    except Exception:
        log.exception("location prompt LLM call failed")
        return None
    text = weave_service._strip_dashes(text.strip().strip('"'))
    return text or None
