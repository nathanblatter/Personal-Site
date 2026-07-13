"""Self-learning vocab pipeline — pulls proper-noun candidates out of raw
transcripts so the name glossary grows from grading, not from hand-editing
journal_vocab.py (which stays as the seed + offline fallback).

Two extractors feed a `vocab_candidates` queue in the journal DB:
  1. heuristic_candidates — capitalized mid-sentence tokens and title-case runs,
     stopword-filtered, fuzzy-matched against the known vocab for a suggestion.
     Deterministic, no dependencies.
  2. llm_candidates — a local 3B model on Ollama that also catches *lowercase*
     garbles a capitalization heuristic can never see ("clod code" → Claude
     Code). Verified on real entries: catches those, but hallucinates candidates
     too, so anything whose surface isn't literally in the transcript is dropped.

Both run at GRADING time, not nightly: opening /journal/vocab scans transcripts
with vocab_scanned_at IS NULL, so the model is only in memory while Nathan is
grading (Ollama unloads it after ~5 idle minutes — same on-demand shape as the
MLX whisper service). Accepting a candidate upserts into `vocab_terms` (variants
array-unioned, so a new mis-hearing of an existing name merges rather than
duplicates). The worker and weave read the merged vocab from the DB per entry,
so a grade takes effect the same night.
"""

import difflib
import json
import logging
import os
import re
from datetime import date as date_type
from typing import Optional

import httpx

from app import journal_vocab

log = logging.getLogger("vocab")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
VOCAB_OLLAMA_MODEL = os.getenv("VOCAB_OLLAMA_MODEL", "llama3.2:3b")

# ---------------------------------------------------------------------------
# DDL (idempotent, executed from init_journal_db)
# ---------------------------------------------------------------------------

CREATE_VOCAB_TERMS = """
CREATE TABLE IF NOT EXISTS vocab_terms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical   TEXT NOT NULL UNIQUE,
    variants    TEXT[] NOT NULL DEFAULT '{}',
    category    TEXT,                -- person|place|other
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_VOCAB_CANDIDATES = """
CREATE TABLE IF NOT EXISTS vocab_candidates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surface             TEXT NOT NULL,
    surface_norm        TEXT NOT NULL UNIQUE,   -- lower(surface), dedup key
    suggested_canonical TEXT,
    context             TEXT,
    entry_date          DATE,
    source              TEXT NOT NULL DEFAULT 'heuristic',  -- heuristic|llm|audit
    status              TEXT NOT NULL DEFAULT 'pending',    -- pending|accepted|rejected
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


# ---------------------------------------------------------------------------
# Heuristic extractor
# ---------------------------------------------------------------------------

# Capitalized words that are conversation scaffolding, kin terms, calendar words,
# or tech initialisms — never worth a vocab entry.
_STOP = {
    "i", "i'm", "i'll", "i've", "i'd", "okay", "ok", "oh", "um", "uh", "yeah",
    "yes", "no", "so", "and", "but", "or", "the", "a", "an", "then", "there",
    "that", "this", "these", "those", "they", "he", "she", "we", "it", "it's",
    "my", "me", "you", "your", "his", "her", "our", "their", "let's", "what",
    "when", "where", "who", "why", "how", "like", "just", "also", "maybe",
    "mom", "dad", "mom's", "dad's", "uncle", "aunt", "grandma", "grandpa",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "tv", "pto", "ai", "wi-fi", "wifi", "gps", "gpt", "vpn", "vpns", "pdf",
    "url", "app", "id", "ceo", "hr", "usa", "us", "la", "am", "pm", "not",
    "miss", "mr", "mrs", "sigh", "god",
}

# One capitalized word: Title-case (allowing internal caps like In-N-Out pieces,
# apostrophes, hyphens) or a short all-caps initialism (BYU, SFO, MTC).
_CAP_WORD = re.compile(r"^(?:[A-Z][a-zA-Z'’-]+|[A-Z]{2,6}(?:'s)?)$")
_TOKEN = re.compile(r"[A-Za-z][A-Za-z'’-]*")
# Commas/semicolons also end a run ("the Chipotle, Megan had her tutor" must not
# produce "Chipotle Megan") but are NOT sentence starts: a capital right after a
# comma is itself a proper-noun signal, so only the true sentence boundary demotes
# a leading capital. Likewise "and" is not a connector — "Jackson and Kami and
# Macy" should surface as individual names, not one phrase.
_SENT_SPLIT = re.compile(r"[.!?\n]+")
_CLAUSE_SPLIT = re.compile(r"[,;:]+")
# Connectors allowed inside a multi-word run ("University of Utah" style).
_CONNECTORS = {"of"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip()).lower().replace("’", "'")


def _context(text: str, phrase: str, width: int = 70) -> str:
    i = text.find(phrase)
    if i < 0:
        return ""
    start, end = max(0, i - width), min(len(text), i + len(phrase) + width)
    return ("…" if start else "") + text[start:end].strip() + ("…" if end < len(text) else "")


def heuristic_candidates(text: str) -> list[dict]:
    """Extract proper-noun candidate phrases from one transcript.

    Groups consecutive capitalized tokens (allowing lowercase connectors between
    them) into phrases. A single sentence-initial capitalized word only counts if
    the same word also appears capitalized mid-sentence somewhere in the text,
    which filters ordinary sentence-start capitalization.
    """
    mid_sentence_caps: set[str] = set()
    runs: list[tuple[str, bool]] = []  # (phrase, starts_sentence)

    for sent in _SENT_SPLIT.split(text):
        for ci, clause in enumerate(_CLAUSE_SPLIT.split(sent)):
            tokens = _TOKEN.findall(clause)
            i = 0
            while i < len(tokens):
                tok = tokens[i]
                if not (_CAP_WORD.match(tok) and _norm(tok) not in _STOP):
                    i += 1
                    continue
                run = [tok]
                j = i + 1
                while j < len(tokens):
                    nxt = tokens[j]
                    if _CAP_WORD.match(nxt) and _norm(nxt) not in _STOP:
                        run.append(nxt)
                        j += 1
                    elif (nxt in _CONNECTORS and j + 1 < len(tokens)
                          and _CAP_WORD.match(tokens[j + 1])
                          and _norm(tokens[j + 1]) not in _STOP):
                        run.append(nxt)
                        run.append(tokens[j + 1])
                        j += 2
                    else:
                        break
                phrase = " ".join(run)
                starts_sentence = ci == 0 and i == 0
                if not starts_sentence or len(run) > 1:
                    for w in run:
                        if _CAP_WORD.match(w):
                            mid_sentence_caps.add(_norm(w))
                runs.append((phrase, starts_sentence))
                i = j

    seen: set[str] = set()
    out: list[dict] = []
    for phrase, starts_sentence in runs:
        key = _norm(phrase)
        if key in seen:
            continue
        if starts_sentence and " " not in phrase and key not in mid_sentence_caps:
            continue  # plain sentence-start capitalization
        seen.add(key)
        out.append({"surface": phrase.rstrip("'s") if phrase.endswith("'s") else phrase,
                    "context": _context(text, phrase)})
    return out


def suggest_canonical(surface: str, vocab: dict[str, list[str]]) -> Optional[str]:
    """Fuzzy-match a candidate against known canonicals + variants."""
    lookup: dict[str, str] = {}
    for canonical, variants in vocab.items():
        lookup[_norm(canonical)] = canonical
        for v in variants:
            lookup[_norm(v)] = canonical
    hits = difflib.get_close_matches(_norm(surface), list(lookup), n=1, cutoff=0.78)
    return lookup[hits[0]] if hits else None


# ---------------------------------------------------------------------------
# LLM extractor — catches lowercase garbles the heuristic can't
# ---------------------------------------------------------------------------

_LLM_PROMPT = """You extract proper nouns from raw voice-journal transcripts (Whisper output, so names are often mis-transcribed).

Return every distinct proper noun: people, places, businesses, products, projects, media titles. CRUCIALLY, also flag phrases that look like a mis-transcription of a name or brand even when lowercase or word-split (e.g. "clod code" is likely "Claude Code"). For each, guess the correct spelling if you suspect a garble; otherwise repeat the surface form. Only emit phrases that appear verbatim in THIS transcript.

Known vocabulary (canonical spellings that already exist — do NOT emit these unless the transcript garbles them a NEW way):
{glossary}

Return ONLY valid JSON, no prose, exactly this shape:
{{"candidates": [{{"surface": "<exact text from transcript>", "suggestion": "<best-guess correct spelling>", "note": "<one short clause on why, empty if obvious>"}}]}}"""

# One candidate object at a time: the 3B model sometimes emits structurally
# broken JSON (e.g. duplicate "candidates" keys, which json.loads silently
# collapses to the last one), so pull out every {...} that has a "surface".
_CAND_OBJ = re.compile(r'\{[^{}]*"surface"[^{}]*\}')


def _parse_llm_output(out: str, raw_text: str) -> list[dict]:
    """Lenient parse + anti-hallucination guard: a candidate only counts if its
    surface literally appears in the transcript (case-insensitive). Verified to
    kill every hallucination the 3B produced in testing (prompt-example echoes,
    glossary echoes, invented phrases)."""
    haystack = raw_text.lower()
    cands, seen = [], set()
    for m in _CAND_OBJ.finditer(out):
        try:
            c = json.loads(m.group(0))
        except Exception:
            continue
        surface = (c.get("surface") or "").strip()
        key = _norm(surface)
        if not surface or len(surface) > 60 or key in seen:
            continue
        if surface.lower() not in haystack:
            continue  # hallucinated — not in the transcript
        seen.add(key)
        suggestion = (c.get("suggestion") or "").strip() or None
        cands.append({
            "surface": surface,
            "suggestion": suggestion,
            "context": _context(raw_text, surface) or (c.get("note") or ""),
        })
    return cands


async def llm_candidates(raw_text: str, glossary: str) -> list[dict]:
    """One local-3B pass over a transcript for proper nouns + suspected garbles.
    Best-effort: any failure (Ollama down, model missing) returns []."""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": VOCAB_OLLAMA_MODEL,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": _LLM_PROMPT.format(glossary=glossary)},
                        {"role": "user", "content": raw_text},
                    ],
                },
            )
            resp.raise_for_status()
            out = resp.json().get("message", {}).get("content", "")
        return _parse_llm_output(out, raw_text)
    except Exception as exc:
        log.warning("llm candidate extraction failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# DB layer
# ---------------------------------------------------------------------------

async def fetch_vocab(conn) -> dict[str, list[str]]:
    """Merged vocab from vocab_terms; falls back to the static seed if empty."""
    rows = await conn.fetch("SELECT canonical, variants FROM vocab_terms ORDER BY canonical")
    if not rows:
        return dict(journal_vocab.CANONICAL)
    return {r["canonical"]: list(r["variants"] or []) for r in rows}


async def known_norms(conn) -> set[str]:
    """Every normalized spelling already covered by vocab_terms."""
    known: set[str] = set()
    for r in await conn.fetch("SELECT canonical, variants FROM vocab_terms"):
        known.add(_norm(r["canonical"]))
        for v in r["variants"] or []:
            known.add(_norm(v))
    return known


async def record_candidates(
    conn,
    cands: list[dict],
    entry_date: Optional[date_type] = None,
    source: str = "heuristic",
) -> int:
    """Queue candidates for grading. Skips anything already in the vocab and
    anything already queued/graded (unique surface_norm: a rejection is
    permanent, an acceptance isn't re-asked)."""
    known = await known_norms(conn)
    vocab = await fetch_vocab(conn)
    inserted = 0
    for c in cands:
        surface = c["surface"].strip()
        key = _norm(surface)
        if not key or key in known:
            continue
        suggestion = c.get("suggestion") or suggest_canonical(surface, vocab)
        if suggestion and _norm(suggestion) == key:
            suggestion = None  # spelled right already; suggestion adds nothing
        done = await conn.execute(
            "INSERT INTO vocab_candidates (surface, surface_norm, suggested_canonical, context, entry_date, source) "
            "VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (surface_norm) DO NOTHING",
            surface, key, suggestion, c.get("context") or "", entry_date, source,
        )
        if done.endswith("1"):
            inserted += 1
    return inserted


async def accept_candidate(conn, candidate_id, canonical: str, variants: list[str], category: Optional[str]) -> None:
    """Grade a candidate as accepted: upsert the term, array-unioning variants so
    a new mis-hearing of an existing name merges into that term."""
    canonical = canonical.strip()
    variants = [v.strip() for v in variants if v.strip() and _norm(v) != _norm(canonical)]
    await conn.execute(
        "INSERT INTO vocab_terms (canonical, variants, category) VALUES ($1, $2, $3) "
        "ON CONFLICT (canonical) DO UPDATE SET "
        "variants = (SELECT ARRAY(SELECT DISTINCT unnest(vocab_terms.variants || EXCLUDED.variants))), "
        "category = COALESCE(EXCLUDED.category, vocab_terms.category), updated_at = NOW()",
        canonical, variants, category,
    )
    await conn.execute(
        "UPDATE vocab_candidates SET status = 'accepted' WHERE id = $1", candidate_id
    )


async def ensure_seed(conn) -> None:
    """Idempotently seed vocab_terms from the static file. ON CONFLICT DO NOTHING
    so grading-UI edits are never overwritten by a redeploy."""
    for canonical, variants in journal_vocab.CANONICAL.items():
        await conn.execute(
            "INSERT INTO vocab_terms (canonical, variants) VALUES ($1, $2) "
            "ON CONFLICT (canonical) DO NOTHING",
            canonical, list(variants),
        )


# One-time seed of hand-audited garbles from the Jul 4-11 close read: the ones a
# capitalization heuristic can never find (lowercase / phonetic). New entries get
# the LLM pass instead; this covers the backfill window. record_candidates'
# ON CONFLICT + known-vocab skip make re-running this a no-op.
AUDIT_CANDIDATES: list[dict] = [
    {"surface": "clotted", "suggestion": "Claude", "context": "I just clotted in the sky / and so i clotted, um, i used my clod code subscription"},
    {"surface": "clod code", "suggestion": "Claude Code", "context": "i used my clod code subscription"},
    {"surface": "Blotter", "suggestion": "Blatter", "context": "reservation for Santa Harbor and Tahoe next year for the Blotter Family reunion"},
    {"surface": "Santa Harbor", "suggestion": "Sand Harbor", "context": "getting a reservation for Santa Harbor and Tahoe next year"},
    {"surface": "Bart", "suggestion": "BART", "context": "I left the house at 4, for Bart, um, and Bart was uneventful, made it to SFO"},
    {"surface": "wine rolls", "suggestion": "Hawaiian rolls", "context": "ham and cheese sandwiches on wine rolls that Char made"},
    {"surface": "Kami", "suggestion": "Kammi", "context": "I went out and sat with Kami / hung out in the car with Jackson and Kami and Macy"},
    {"surface": "Rick Devins", "suggestion": "Rick Devens", "context": "big brother premier. they brought back crazy Angela and Rick Devins"},
    {"surface": "Betos", "suggestion": "Beto's", "context": "I went to Betos and got a Machaca breakfast burrito"},
]


async def seed_audit(conn) -> None:
    """Queue the hand-audited garbles (idempotent: surface_norm conflicts and the
    known-vocab skip make re-running a no-op, and a rejection is never re-asked)."""
    await record_candidates(conn, AUDIT_CANDIDATES, None, "audit")


def _glossary_text(vocab: dict[str, list[str]]) -> str:
    return "\n".join(f"- {c}" for c in vocab)


async def scan_unscanned(conn) -> dict:
    """Grading-time scan: run both extractors over every transcript that hasn't
    been scanned yet, queue candidates, and stamp vocab_scanned_at. This is the
    only place the 3B model runs, so it's loaded only while Nathan is grading."""
    rows = await conn.fetch(
        "SELECT t.id, t.raw_text, e.entry_date FROM transcripts t "
        "JOIN recordings r ON r.id = t.recording_id "
        "JOIN entries e ON e.id = r.entry_id "
        "WHERE t.raw_text IS NOT NULL AND t.vocab_scanned_at IS NULL "
        "ORDER BY e.entry_date"
    )
    vocab = await fetch_vocab(conn)
    glossary = _glossary_text(vocab)
    new_count = 0
    for row in rows:
        cands = heuristic_candidates(row["raw_text"])
        new_count += await record_candidates(conn, cands, row["entry_date"], "heuristic")
        llm = await llm_candidates(row["raw_text"], glossary)
        new_count += await record_candidates(conn, llm, row["entry_date"], "llm")
        await conn.execute(
            "UPDATE transcripts SET vocab_scanned_at = NOW() WHERE id = $1", row["id"]
        )
    return {"scanned": len(rows), "new_candidates": new_count}
