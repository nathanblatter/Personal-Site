"""Weave / cleanup service — turns a day's raw transcripts into one coherent,
quote-biased journal entry plus structured drift flags.

Provider-pluggable (WEAVE_PROVIDER=claude|ollama, default claude). Claude is the
default for quote-fidelity now; the Ollama-local path keeps everything on-box for
the privacy pilot (PRD open decision #1). One LLM call over all of a day's takes,
concatenated in sequence order.
"""

import json
import logging
import os
import re
from typing import Optional

import httpx

from app import journal_vocab

log = logging.getLogger("weave")

WEAVE_PROVIDER = os.getenv("WEAVE_PROVIDER", "claude").lower()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("WEAVE_MODEL", "claude-sonnet-4-6")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("WEAVE_OLLAMA_MODEL", "llama3.1:8b")

# PRD weave prompt + style constraints, name glossary, and a JSON output contract.
WEAVE_PROMPT = """You're given one or more raw transcripts from the same day, in chronological order. Some may cover different topics, or return to the same topic later in the day. Organize this into one coherent journal entry that reads narratively, roughly following the arc of the day.

Rules:
- Prefer the person's own words and phrasing over paraphrase, especially for anything opinionated, emotional, funny, or specific. Light editing for grammar and filler is fine; full rewriting is not.
- You may reorder content for narrative flow (e.g. grouping a topic that was mentioned twice into one place) but do not invent transitions implying something happened that didn't, and do not drop hedges, uncertainty, or contradictions, since those are real content.
- If takes are disjoint (different topics, no natural order), use simple time-of-day framing rather than forcing a false narrative thread between them.
- Do not summarize. Every concrete detail, name, and claim in the raw transcripts should appear in the output.

Style:
- NEVER use em dashes or en dashes (— or –). Use periods or commas instead. This is a hard rule.
- Write plainly and naturally in the person's own voice. Do not add literary flourish, dramatic phrasing, or "writerly" transitions the person wouldn't say.

Names: the transcript may misspell recurring people/places. Normalize them to these canonical spellings when clearly the same person/place. This is a correction, NOT drift, so do NOT create a drift flag for it:
{glossary}

Alongside the narrative, output a structured list of any place where your version drops, adds, or alters a factual CLAIM, hedge, or emotional qualifier versus the raw transcripts. Tag each as "structural" (reordering, merged repeated topic, added transition) or "content" (changed meaning). Only "content" tags matter for review. Do not flag grammar/filler cleanup or the name normalizations above.

Return ONLY valid JSON, no prose outside it, in exactly this shape:
{{
  "narrative": "<the woven journal entry>",
  "drift_flags": [
    {{"category": "structural" | "content", "note": "<what changed>", "raw_span": "<the affected phrase from the raw transcript>"}}
  ]
}}
If nothing drifted, return an empty drift_flags array.""".format(glossary=journal_vocab.weave_glossary())


# Nathan dislikes em/en dashes; strip them deterministically so we never depend on
# the model obeying the style rule. Separator dashes become commas.
def _strip_dashes(text: str) -> str:
    text = re.sub(r"\s*[—–]\s*", ", ", text)     # em/en dash -> comma
    text = re.sub(r"\s+--?\s+", ", ", text)                # spaced hyphen/double-hyphen dash-substitute -> comma
    text = re.sub(r"\s*,(\s*,)+\s*", ", ", text)           # collapse runs of commas -> ", "
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)           # no space before punctuation
    text = re.sub(r" {2,}", " ", text)                     # collapse multiple spaces
    return text


def _build_input(raw_texts: list[str]) -> str:
    """Concatenate the day's raw transcripts in sequence order for the prompt."""
    parts = []
    for i, text in enumerate(raw_texts, 1):
        parts.append(f"--- Take {i} ---\n{text.strip()}")
    return "\n\n".join(parts)


def _parse_response(text: str, raw_texts: list[str]) -> dict:
    """Parse the model's JSON. On failure, fall back to raw concatenation so a
    memory is never lost to a bad parse (the raw transcripts remain the source of truth)."""
    cleaned = text.strip()
    # Strip ```json ... ``` fences if present.
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        data = json.loads(m.group(0) if m else cleaned)
        narrative = (data.get("narrative") or "").strip()
        flags = data.get("drift_flags") or []
        if not narrative:
            raise ValueError("empty narrative")
    except Exception as exc:
        log.warning("weave parse failed (%s); falling back to raw concatenation", exc)
        return {
            "narrative": _strip_dashes("\n\n".join(t.strip() for t in raw_texts)),
            "drift_flags": [{"category": "content", "note": "weave failed to parse, showing raw", "raw_span": ""}],
            "drift_score": 999.0,
        }
    content_flags = [f for f in flags if (f or {}).get("category") == "content"]
    return {
        "narrative": _strip_dashes(narrative),
        "drift_flags": flags,
        "drift_score": float(len(content_flags)),
    }


async def _claude(system: str, user: str, max_tokens: int, want_json: bool) -> str:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return "".join(block.get("text", "") for block in data.get("content", []))


async def _ollama(system: str, user: str, max_tokens: int, want_json: bool) -> str:
    async with httpx.AsyncClient(timeout=300.0) as client:
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if want_json:
            payload["format"] = "json"
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "")


async def call_llm(system: str, user: str, max_tokens: int = 4096, want_json: bool = True) -> str:
    """Provider-agnostic single-turn completion, reused by weave + prompt extraction."""
    if WEAVE_PROVIDER == "ollama":
        return await _ollama(system, user, max_tokens, want_json)
    return await _claude(system, user, max_tokens, want_json)


async def weave_day(raw_texts: list[str]) -> dict:
    """Weave a day's raw transcripts. Returns {narrative, drift_flags, drift_score}."""
    raw_texts = [t for t in raw_texts if t and t.strip()]
    if not raw_texts:
        return {"narrative": "", "drift_flags": [], "drift_score": 0.0}

    text = await call_llm(WEAVE_PROMPT, _build_input(raw_texts))
    return _parse_response(text, raw_texts)
