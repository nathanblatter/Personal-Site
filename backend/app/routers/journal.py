"""Daily voice-journal router.

Mirrors the KPI subsystem's conventions (see app/routers/kpi.py): a separate
Postgres database on the shared docker-services instance with a dedicated asyncpg
pool + idempotent DDL, HMAC-signed date magic links served as self-contained
HTMLResponse pages, and a NateBot nightly text driven by a supervised loop in
main.py's lifespan.

Flow: NateBot texts a signed link nightly → the page lets you record any number of
takes (each auto-saved to MinIO + a `recordings` row on stop), play back / delete /
re-record while the day is open → Submit locks the day (`entries.submitted_at`) and
enqueues the entry on the `journal:submitted` Redis stream for the transcription +
weave worker. Revisiting a submitted day is read-only.
"""

import base64
import hashlib
import hmac
import json
import logging
import math
import os
import uuid
from datetime import date as date_type, datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from app import vocab_service
from app.auth import require_auth
from app.routers.storage import get_s3_client, ensure_bucket, MINIO_BUCKET

log = logging.getLogger("journal")

LOCAL_TZ = ZoneInfo(os.getenv("LOCAL_TZ", "America/Denver"))  # fallback when location lookup fails
KPI_DSN = os.getenv("DATABASE_URL_KPI", "postgresql://postgres:postgres@host.docker.internal:5432/kpi")
SITE_BASE_URL = os.getenv("SITE_BASE_URL", "https://nathanblatter.com")
# Where the standalone journal-builder web UI (docker-services/journal-builder) is
# reachable — used to text a builder magic link. Tailscale IP by default.
BUILDER_BASE_URL = os.getenv("BUILDER_BASE_URL", "http://100.79.61.79:4400")
# The link is a convenience for finding/opening a day, not the access-control layer
# (that's the Tailscale-only tunnel). A day's link never expires by time — an
# unsubmitted day stays recordable forever (miss Jul 5, record it Jul 6 or later).
# Submission is the only thing that closes a day; submitted days resolve read-only.
JOURNAL_LINK_SECRET = os.getenv("JOURNAL_LINK_SECRET", "") or os.getenv("CHURCH_LINK_SECRET", "")

AUDIO_PREFIX = "journal/audio"
SUBMIT_STREAM = "journal:submitted"

_JOURNAL_POOL: asyncpg.Pool | None = None
_redis: aioredis.Redis | None = None


# ---------------------------------------------------------------------------
# Database (separate `journal` DB on the shared Postgres, mirrors init_kpi_db)
# ---------------------------------------------------------------------------

_CREATE_ENTRIES = """
CREATE TABLE IF NOT EXISTS entries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date    DATE UNIQUE NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',   -- open|submitted|processed|reviewed
    submitted_at  TIMESTAMPTZ,                    -- non-null = locked, no more CRUD
    narrative     TEXT,
    final_text    TEXT,
    drift_score   DOUBLE PRECISION,
    drift_flags   JSONB,
    featured      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_CREATE_RECORDINGS = """
CREATE TABLE IF NOT EXISTS recordings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id      UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    audio_ref     TEXT NOT NULL,      -- MinIO object key
    duration_sec  INTEGER,
    sequence      INTEGER NOT NULL,   -- order within the day
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_CREATE_TRANSCRIPTS = """
CREATE TABLE IF NOT EXISTS transcripts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id  UUID NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
    raw_text      TEXT,               -- untouched Whisper output, permanent
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

# photos + prompt_suggestions are created now but unused this slice (EOY / next-day nudge).
_CREATE_PHOTOS = """
CREATE TABLE IF NOT EXISTS photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id    UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    photo_ref   TEXT NOT NULL,
    caption     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_CREATE_PROMPT_SUGGESTIONS = """
CREATE TABLE IF NOT EXISTS prompt_suggestions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id      UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    target_date   DATE NOT NULL,
    prompt_text   TEXT NOT NULL,
    confidence    DOUBLE PRECISION,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_CREATE_MAGIC_LINKS = """
CREATE TABLE IF NOT EXISTS magic_links (
    token       TEXT PRIMARY KEY,
    entry_date  DATE NOT NULL,
    expires_at  TIMESTAMPTZ
);
"""

_CREATE_UPDATED_AT_FN = """
CREATE OR REPLACE FUNCTION journal_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_DROP_ENTRIES_TRIGGER = "DROP TRIGGER IF EXISTS entries_updated_at ON entries;"
_CREATE_ENTRIES_TRIGGER = """
CREATE TRIGGER entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW EXECUTE FUNCTION journal_set_updated_at();
"""


def journal_dsn() -> str:
    return os.getenv(
        "DATABASE_URL_JOURNAL",
        "postgresql://postgres:postgres@host.docker.internal:5432/journal",
    )


async def init_journal_db() -> None:
    """Create the `journal` database if missing, open the pool, run idempotent DDL."""
    global _JOURNAL_POOL
    dsn = journal_dsn()
    parsed = urlparse(dsn)
    admin_url = urlunparse(parsed._replace(path="/postgres"))
    db_name = parsed.path.lstrip("/") or "journal"

    conn = await asyncpg.connect(admin_url)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await conn.close()

    _JOURNAL_POOL = await asyncpg.create_pool(dsn)
    async with _JOURNAL_POOL.acquire() as c:
        await c.execute(_CREATE_ENTRIES)
        await c.execute(_CREATE_RECORDINGS)
        await c.execute(_CREATE_TRANSCRIPTS)
        await c.execute(_CREATE_PHOTOS)
        # EOY builder: photos are curated from Immich and cached into MinIO. Track the
        # source asset id, ordering within a day, and a per-day cover pick. Additive so
        # existing rows are unaffected; `photo_ref` holds the cached MinIO object key.
        await c.execute("ALTER TABLE photos ADD COLUMN IF NOT EXISTS immich_id TEXT")
        await c.execute("ALTER TABLE photos ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'immich'")
        await c.execute("ALTER TABLE photos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
        await c.execute("ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE")
        await c.execute("CREATE UNIQUE INDEX IF NOT EXISTS photos_entry_immich_uq "
                        "ON photos (entry_id, immich_id) WHERE immich_id IS NOT NULL")
        await c.execute(_CREATE_PROMPT_SUGGESTIONS)
        # Next-day prompts: location/fallback prompts have no source entry, and we
        # track delivery + source. Additive so existing rows are unaffected.
        await c.execute("ALTER TABLE prompt_suggestions ALTER COLUMN entry_id DROP NOT NULL")
        await c.execute("ALTER TABLE prompt_suggestions ADD COLUMN IF NOT EXISTS source TEXT")
        await c.execute("ALTER TABLE prompt_suggestions ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ")
        await c.execute(_CREATE_MAGIC_LINKS)
        # Self-learning vocab: graded terms + the candidate queue feeding the
        # /journal/vocab grading UI. Seeds are ON CONFLICT DO NOTHING, so grades
        # are never overwritten by a redeploy.
        await c.execute(vocab_service.CREATE_VOCAB_TERMS)
        await c.execute(vocab_service.CREATE_VOCAB_CANDIDATES)
        await c.execute("ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS vocab_scanned_at TIMESTAMPTZ")
        await vocab_service.ensure_seed(c)
        await vocab_service.seed_audit(c)
        await c.execute(_CREATE_UPDATED_AT_FN)
        await c.execute(_DROP_ENTRIES_TRIGGER)
        await c.execute(_CREATE_ENTRIES_TRIGGER)
    log.info("journal DB ready (%s)", db_name)


async def close_journal_db() -> None:
    global _JOURNAL_POOL, _redis
    if _JOURNAL_POOL:
        await _JOURNAL_POOL.close()
        _JOURNAL_POOL = None
    if _redis:
        await _redis.aclose()
        _redis = None


def _pool() -> asyncpg.Pool:
    if _JOURNAL_POOL is None:
        raise HTTPException(status_code=503, detail="journal DB not ready")
    return _JOURNAL_POOL


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
    return _redis


# ---------------------------------------------------------------------------
# Magic link — HMAC over the date (stateless, same shape as sign_church_token)
# ---------------------------------------------------------------------------

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _journal_signature(date_str: str) -> str:
    sig = hmac.new(JOURNAL_LINK_SECRET.encode(), b"journal:" + date_str.encode(), hashlib.sha256).digest()
    return _b64url_encode(sig)


def sign_journal_token(date_str: str) -> str:
    return f"{_b64url_encode(date_str.encode())}.{_journal_signature(date_str)}"


def verify_journal_token(token: str) -> Optional[date_type]:
    """Return the signed date if the token is valid.

    No past expiry — an unsubmitted day stays recordable indefinitely. The only
    time guard is rejecting far-future dates (allowing +1 day for timezone edges),
    so a guessed/replayed token can't open a day that hasn't happened yet.
    """
    if not JOURNAL_LINK_SECRET:
        return None
    try:
        payload_b64, sig = token.split(".", 1)
        date_str = _b64url_decode(payload_b64).decode()
        if not hmac.compare_digest(_journal_signature(date_str), sig):
            return None
        signed_date = date_type.fromisoformat(date_str)
    except Exception:
        return None
    today = datetime.now(LOCAL_TZ).date()
    if (today - signed_date).days < -1:  # more than a day in the future
        return None
    return signed_date


# Builder token — the standalone journal-builder app spans the whole year (not one
# date), so it's a single opaque HMAC over a constant. The builder shares
# JOURNAL_LINK_SECRET and verifies the same signature locally.
def _builder_signature() -> str:
    sig = hmac.new(JOURNAL_LINK_SECRET.encode(), b"journal-builder", hashlib.sha256).digest()
    return _b64url_encode(sig)


def sign_builder_token() -> str:
    return _builder_signature()


def verify_builder_token(token: str) -> bool:
    if not JOURNAL_LINK_SECRET:
        return False
    return hmac.compare_digest(_builder_signature(), token or "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _ensure_entry(conn, entry_date: date_type) -> asyncpg.Record:
    """Return the entry row for a date, creating an `open` one if it doesn't exist."""
    row = await conn.fetchrow("SELECT * FROM entries WHERE entry_date = $1", entry_date)
    if row is None:
        row = await conn.fetchrow(
            "INSERT INTO entries (entry_date) VALUES ($1) "
            "ON CONFLICT (entry_date) DO UPDATE SET entry_date = EXCLUDED.entry_date "
            "RETURNING *",
            entry_date,
        )
    return row


def _resolve_date_or_404(token: str) -> date_type:
    signed_date = verify_journal_token(token)
    if signed_date is None:
        raise HTTPException(status_code=400, detail="invalid or expired link")
    return signed_date


# ---------------------------------------------------------------------------
# Routes — registered top-level (no /api prefix) like church_link_router so the
# SPA catch-all doesn't swallow them.
# ---------------------------------------------------------------------------

router = APIRouter(tags=["journal"])

_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/journal/{token}/takes", include_in_schema=False)
async def list_takes(token: str):
    entry_date = _resolve_date_or_404(token)
    async with _pool().acquire() as conn:
        entry = await _ensure_entry(conn, entry_date)
        takes = await conn.fetch(
            "SELECT id, duration_sec, sequence, created_at FROM recordings "
            "WHERE entry_id = $1 ORDER BY sequence",
            entry["id"],
        )
    return JSONResponse(
        {
            "date": entry_date.isoformat(),
            "submitted": entry["submitted_at"] is not None,
            "status": entry["status"],
            "takes": [
                {
                    "id": str(t["id"]),
                    "sequence": t["sequence"],
                    "duration_sec": t["duration_sec"],
                    "created_at": t["created_at"].isoformat(),
                }
                for t in takes
            ],
        },
        headers=_NO_STORE,
    )


@router.post("/journal/{token}/takes", include_in_schema=False)
async def add_take(
    token: str,
    file: UploadFile = File(...),
    duration_sec: Optional[int] = Form(None),
):
    entry_date = _resolve_date_or_404(token)
    async with _pool().acquire() as conn:
        entry = await _ensure_entry(conn, entry_date)
        if entry["submitted_at"] is not None:
            raise HTTPException(status_code=409, detail="day already submitted")

        ext = os.path.splitext(file.filename or "")[1] or ".webm"
        key = f"{AUDIO_PREFIX}/{entry_date.isoformat()}/{uuid.uuid4().hex}{ext}"
        contents = await file.read()

        client = get_s3_client()
        ensure_bucket(client)
        client.put_object(
            Bucket=MINIO_BUCKET,
            Key=key,
            Body=contents,
            ContentType=file.content_type or "audio/webm",
        )

        next_seq = await conn.fetchval(
            "SELECT COALESCE(MAX(sequence), 0) + 1 FROM recordings WHERE entry_id = $1",
            entry["id"],
        )
        take = await conn.fetchrow(
            "INSERT INTO recordings (entry_id, audio_ref, duration_sec, sequence) "
            "VALUES ($1, $2, $3, $4) RETURNING id, sequence, duration_sec, created_at",
            entry["id"], key, duration_sec, next_seq,
        )
    return JSONResponse(
        {
            "id": str(take["id"]),
            "sequence": take["sequence"],
            "duration_sec": take["duration_sec"],
            "created_at": take["created_at"].isoformat(),
        },
        status_code=201,
        headers=_NO_STORE,
    )


@router.delete("/journal/{token}/takes/{take_id}", include_in_schema=False)
async def delete_take(token: str, take_id: str):
    entry_date = _resolve_date_or_404(token)
    async with _pool().acquire() as conn:
        entry = await conn.fetchrow("SELECT * FROM entries WHERE entry_date = $1", entry_date)
        if entry is None:
            raise HTTPException(status_code=404, detail="no such day")
        if entry["submitted_at"] is not None:
            raise HTTPException(status_code=409, detail="day already submitted")
        take = await conn.fetchrow(
            "SELECT audio_ref FROM recordings WHERE id = $1 AND entry_id = $2",
            uuid.UUID(take_id), entry["id"],
        )
        if take is None:
            raise HTTPException(status_code=404, detail="no such take")
        await conn.execute("DELETE FROM recordings WHERE id = $1", uuid.UUID(take_id))

    try:
        get_s3_client().delete_object(Bucket=MINIO_BUCKET, Key=take["audio_ref"])
    except Exception:
        log.warning("failed to delete audio object %s", take["audio_ref"])
    return JSONResponse({"deleted": take_id}, headers=_NO_STORE)


@router.get("/journal/{token}/audio/{take_id}", include_in_schema=False)
async def get_audio(token: str, take_id: str):
    entry_date = _resolve_date_or_404(token)
    async with _pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT r.audio_ref FROM recordings r "
            "JOIN entries e ON e.id = r.entry_id "
            "WHERE r.id = $1 AND e.entry_date = $2",
            uuid.UUID(take_id), entry_date,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="no such take")
    try:
        obj = get_s3_client().get_object(Bucket=MINIO_BUCKET, Key=row["audio_ref"])
    except Exception:
        raise HTTPException(status_code=404, detail="audio missing")
    return StreamingResponse(
        obj["Body"],
        media_type=obj.get("ContentType", "audio/webm"),
        headers=_NO_STORE,
    )


@router.post("/journal/{token}/submit", include_in_schema=False)
async def submit_day(token: str):
    entry_date = _resolve_date_or_404(token)
    async with _pool().acquire() as conn:
        entry = await _ensure_entry(conn, entry_date)
        has_takes = await conn.fetchval(
            "SELECT COUNT(*) FROM recordings WHERE entry_id = $1", entry["id"]
        )
        if not has_takes:
            raise HTTPException(status_code=400, detail="nothing recorded yet")
        # Idempotent: only the first submit flips the gate + enqueues.
        locked = await conn.fetchrow(
            "UPDATE entries SET submitted_at = NOW(), status = 'submitted' "
            "WHERE id = $1 AND submitted_at IS NULL RETURNING id",
            entry["id"],
        )
    if locked is not None:
        r = await _get_redis()
        await r.xadd(SUBMIT_STREAM, {"entry_id": str(locked["id"]), "date": entry_date.isoformat()})
        log.info("journal day %s submitted, enqueued %s", entry_date, locked["id"])
    return JSONResponse({"submitted": True, "date": entry_date.isoformat()}, headers=_NO_STORE)


@router.post("/journal/builder-link", include_in_schema=False)
async def builder_link(_: None = Depends(require_auth)):
    """Text a magic link to the standalone EOY journal-builder app. Authed (admin),
    reusing the same iMessage relay as the nightly reminder. Defined before the
    /journal/{token} catch-all so this static path isn't captured as a token."""
    if not JOURNAL_LINK_SECRET:
        raise HTTPException(status_code=503, detail="JOURNAL_LINK_SECRET not configured")
    from app import imessage_service  # local import mirrors the reminder's pattern
    url = f"{BUILDER_BASE_URL}/?t={sign_builder_token()}"
    await imessage_service.send_alert(f"📖 Journal builder — tap to open:\n{url}")
    return JSONResponse({"ok": True, "url": url}, headers=_NO_STORE)


# ---------------------------------------------------------------------------
# Vocab grading UI — Tailscale-only, token-gated like the builder. Opening the
# page kicks off a scan of un-scanned transcripts (heuristic + local 3B model),
# so extraction inference only runs while Nathan is actually grading.
# Registered before the /journal/{token} catch-all so "vocab" isn't read as a token.
# ---------------------------------------------------------------------------

def _vocab_signature() -> str:
    sig = hmac.new(JOURNAL_LINK_SECRET.encode(), b"journal-vocab", hashlib.sha256).digest()
    return _b64url_encode(sig)


def sign_vocab_token() -> str:
    return _vocab_signature()


def verify_vocab_token(token: str) -> bool:
    if not JOURNAL_LINK_SECRET:
        return False
    return hmac.compare_digest(_vocab_signature(), token or "")


def _require_vocab_token(t: str) -> None:
    if not verify_vocab_token(t):
        raise HTTPException(status_code=403, detail="invalid vocab token")


@router.get("/journal/vocab", response_class=HTMLResponse, include_in_schema=False)
async def vocab_page(t: str = ""):
    if not verify_vocab_token(t):
        return HTMLResponse(_shell("Invalid link", "This vocab link isn't valid.", ok=False),
                            status_code=403, headers=_NO_STORE)
    return HTMLResponse(_vocab_grading_page(t), headers=_NO_STORE)


@router.get("/journal/vocab/state", include_in_schema=False)
async def vocab_state(t: str = ""):
    _require_vocab_token(t)
    async with _pool().acquire() as conn:
        pending = await conn.fetch(
            "SELECT id, surface, suggested_canonical, context, entry_date, source "
            "FROM vocab_candidates WHERE status = 'pending' ORDER BY source = 'heuristic', created_at"
        )
        terms = await conn.fetch(
            "SELECT id, canonical, variants, category FROM vocab_terms ORDER BY canonical"
        )
        unscanned = await conn.fetchval(
            "SELECT COUNT(*) FROM transcripts WHERE raw_text IS NOT NULL AND vocab_scanned_at IS NULL"
        )
    return JSONResponse({
        "pending": [
            {
                "id": str(c["id"]),
                "surface": c["surface"],
                "suggestion": c["suggested_canonical"],
                "context": c["context"],
                "entry_date": c["entry_date"].isoformat() if c["entry_date"] else None,
                "source": c["source"],
            }
            for c in pending
        ],
        "terms": [
            {"id": str(x["id"]), "canonical": x["canonical"],
             "variants": list(x["variants"] or []), "category": x["category"]}
            for x in terms
        ],
        "unscanned": unscanned,
    }, headers=_NO_STORE)


@router.post("/journal/vocab/scan", include_in_schema=False)
async def vocab_scan(t: str = ""):
    _require_vocab_token(t)
    async with _pool().acquire() as conn:
        result = await vocab_service.scan_unscanned(conn)
    return JSONResponse(result, headers=_NO_STORE)


@router.post("/journal/vocab/grade", include_in_schema=False)
async def vocab_grade(payload: dict, t: str = ""):
    _require_vocab_token(t)
    cand_id = uuid.UUID(str(payload.get("id")))
    action = payload.get("action")
    async with _pool().acquire() as conn:
        if action == "accept":
            canonical = (payload.get("canonical") or "").strip()
            if not canonical:
                raise HTTPException(status_code=400, detail="canonical required")
            await vocab_service.accept_candidate(
                conn, cand_id, canonical,
                [v for v in (payload.get("variants") or [])],
                payload.get("category") or None,
            )
        elif action == "reject":
            await conn.execute(
                "UPDATE vocab_candidates SET status = 'rejected' WHERE id = $1", cand_id
            )
        else:
            raise HTTPException(status_code=400, detail="unknown action")
    return JSONResponse({"ok": True}, headers=_NO_STORE)


@router.post("/journal/vocab/terms", include_in_schema=False)
async def vocab_terms_edit(payload: dict, t: str = ""):
    _require_vocab_token(t)
    action = payload.get("action")
    async with _pool().acquire() as conn:
        if action == "add":
            canonical = (payload.get("canonical") or "").strip()
            if not canonical:
                raise HTTPException(status_code=400, detail="canonical required")
            await conn.execute(
                "INSERT INTO vocab_terms (canonical, variants, category) VALUES ($1, $2, $3) "
                "ON CONFLICT (canonical) DO UPDATE SET variants = EXCLUDED.variants, updated_at = NOW()",
                canonical, [v.strip() for v in (payload.get("variants") or []) if v.strip()],
                payload.get("category") or None,
            )
        elif action == "update":
            await conn.execute(
                "UPDATE vocab_terms SET canonical = $2, variants = $3, updated_at = NOW() WHERE id = $1",
                uuid.UUID(str(payload.get("id"))),
                (payload.get("canonical") or "").strip(),
                [v.strip() for v in (payload.get("variants") or []) if v.strip()],
            )
        elif action == "delete":
            await conn.execute("DELETE FROM vocab_terms WHERE id = $1", uuid.UUID(str(payload.get("id"))))
        else:
            raise HTTPException(status_code=400, detail="unknown action")
    return JSONResponse({"ok": True}, headers=_NO_STORE)


@router.get("/journal/{token}", response_class=HTMLResponse, include_in_schema=False)
async def journal_page(token: str):
    signed_date = verify_journal_token(token)
    if signed_date is None:
        return HTMLResponse(_shell("Invalid link", "This journal link isn't valid.", ok=False),
                            status_code=400, headers=_NO_STORE)
    async with _pool().acquire() as conn:
        entry = await _ensure_entry(conn, signed_date)
    pretty = signed_date.strftime("%A, %B ") + str(signed_date.day)
    nav = _day_nav(signed_date)
    if entry["submitted_at"] is not None:
        return HTMLResponse(_read_only_page(pretty, entry, nav), headers=_NO_STORE)
    return HTMLResponse(_recording_page(token, signed_date, pretty, nav), headers=_NO_STORE)


# ---------------------------------------------------------------------------
# NateBot nightly trigger
# ---------------------------------------------------------------------------

# In-memory guard so the supervised loop texts at most once per day.
_last_journal_reminder: Optional[date_type] = None
JOURNAL_REMINDER_HOUR = int(os.getenv("JOURNAL_REMINDER_HOUR", "19"))          # 7pm local
JOURNAL_REMINDER_WINDOW_HOURS = int(os.getenv("JOURNAL_REMINDER_WINDOW_HOURS", "3"))

# Timezone follows Nathan's latest location fix (he travels UT/CA), cached briefly.
_tz_cache: Optional[tuple] = None
_TZ_CACHE_TTL_SEC = 3600


async def resolve_local_tz() -> ZoneInfo:
    """Current timezone from the most recent KPI location fix, so '7pm local' tracks
    where Nathan actually is. Falls back to the static LOCAL_TZ on any failure."""
    global _tz_cache
    now = datetime.now(timezone.utc)
    if _tz_cache and (now - _tz_cache[0]).total_seconds() < _TZ_CACHE_TTL_SEC:
        return _tz_cache[1]
    tz = LOCAL_TZ
    try:
        conn = await asyncpg.connect(KPI_DSN, timeout=5)
        try:
            row = await conn.fetchrow(
                "SELECT lat, lon FROM location_log WHERE lat IS NOT NULL ORDER BY ts DESC LIMIT 1"
            )
        finally:
            await conn.close()
        if row:
            from tzfpy import get_tz
            name = get_tz(float(row["lon"]), float(row["lat"]))
            if name:
                tz = ZoneInfo(name)
    except Exception as exc:
        log.info("tz resolve fell back to %s: %s", LOCAL_TZ.key, exc)
    _tz_cache = (now, tz)
    return tz


# ---------------------------------------------------------------------------
# Next-day prompt suggestions (content-derived + location-derived + fallback)
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _match_visited(points: list[tuple[float, float]], labels: list[dict]) -> list[str]:
    """Return labeled place names visited, ordered by dwell (number of trail points
    that fell inside the label's radius)."""
    counts: dict[str, int] = {}
    for plat, plon in points:
        for lb in labels:
            if _haversine_m(plat, plon, lb["lat"], lb["lon"]) <= (lb["radius_m"] or 100):
                counts[lb["name"]] = counts.get(lb["name"], 0) + 1
    return [name for name, _ in sorted(counts.items(), key=lambda kv: -kv[1])]


async def _visited_labels(day: date_type, tz: ZoneInfo) -> list[str]:
    """Labeled places (from the KPI location system) visited on the given local day."""
    start = datetime(day.year, day.month, day.day, tzinfo=tz)
    end = start + timedelta(days=1)
    try:
        conn = await asyncpg.connect(KPI_DSN, timeout=5)
        try:
            labels = await conn.fetch("SELECT name, lat, lon, radius_m FROM location_labels")
            points = await conn.fetch(
                "SELECT lat, lon FROM location_log WHERE lat IS NOT NULL AND ts >= $1 AND ts < $2",
                start, end,
            )
        finally:
            await conn.close()
    except Exception as exc:
        log.info("location lookup skipped: %s", exc)
        return []
    return _match_visited(
        [(p["lat"], p["lon"]) for p in points],
        [dict(l) for l in labels],
    )


async def _todays_prompt(today: date_type, tz: ZoneInfo) -> Optional[str]:
    """Pick one gentle suggestion for today's text: best stored content prompt, else
    a location prompt from today's visited places, else a fallback. Records the choice."""
    from app import prompt_service

    async with _pool().acquire() as conn:
        # Follow up on forward-looking items from recent entries that are now due
        # (target on/before today, within the last week, not yet sent).
        content = await conn.fetchrow(
            "SELECT id, prompt_text FROM prompt_suggestions "
            "WHERE source = 'content' AND sent_at IS NULL "
            "AND target_date <= $1 AND target_date >= $1 - 7 "
            "ORDER BY target_date DESC, confidence DESC NULLS LAST, created_at LIMIT 1",
            today,
        )
        if content:
            await conn.execute("UPDATE prompt_suggestions SET sent_at = NOW() WHERE id = $1", content["id"])
            return content["prompt_text"]

        # No pending follow-up: try today's labeled places (season-aware).
        loc = await prompt_service.location_prompt(await _visited_labels(today, tz), today)
        chosen = loc or prompt_service.pick_fallback()
        await conn.execute(
            "INSERT INTO prompt_suggestions (target_date, prompt_text, confidence, source, sent_at) "
            "VALUES ($1, $2, $3, $4, NOW())",
            today, chosen, 0.7 if loc else 0.0, "location" if loc else "fallback",
        )
        return chosen


async def send_journal_reminder(force: bool = False) -> str:
    """Text tonight's journal magic link, at most once per evening.

    The date is in the text itself, so a missed day is findable later by scrolling
    Messages and tapping that day's link — no separate backfill UI. `force=True`
    bypasses the window/day-guard for manual end-to-end testing.
    """
    global _last_journal_reminder
    from app import imessage_service  # local import mirrors kpi's usage pattern

    tz = await resolve_local_tz()
    now = datetime.now(tz)
    today = now.date()

    if not force:
        window_end = JOURNAL_REMINDER_HOUR + JOURNAL_REMINDER_WINDOW_HOURS
        if not (JOURNAL_REMINDER_HOUR <= now.hour < window_end):
            return "skip: outside send window"
        if _last_journal_reminder == today:
            return "skip: already sent today"

    if not JOURNAL_LINK_SECRET:
        log.warning("JOURNAL_LINK_SECRET not set — cannot send journal reminder")
        return "skip: no secret configured"

    url = f"{SITE_BASE_URL}/journal/{sign_journal_token(today.isoformat())}"
    label = today.strftime("%b ") + str(today.day)
    prefix = "[test] " if force else ""
    text = f"{prefix}{label} journal 🎙️ tap to record:\n{url}"
    try:
        prompt = await _todays_prompt(today, tz)
        if prompt:
            text += f"\n\n💭 Maybe talk about: {prompt}"
    except Exception:
        log.exception("prompt suggestion failed; sending plain reminder")
    await imessage_service.send_alert(text)
    if not force:
        _last_journal_reminder = today
    result = f"sent journal reminder for {today.isoformat()}"
    return f"{result} (test)" if force else result


# ---------------------------------------------------------------------------
# HTML (self-contained, matches _church_page styling)
# ---------------------------------------------------------------------------

_BASE_CSS = """
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0b0b0f;color:#f5f5f7;padding:24px;max-width:640px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#a1a1aa;font-size:14px;margin:0 0 24px}
  button{font:inherit;border:0;border-radius:12px;padding:14px 18px;cursor:pointer}
  .rec{background:#dc2626;color:#fff;font-size:18px;width:100%;margin-bottom:16px}
  .rec.recording{background:#7f1d1d}
  .submit{background:#16a34a;color:#fff;width:100%;font-size:16px;margin-top:20px}
  .submit:disabled{background:#374151;color:#9ca3af;cursor:not-allowed}
  .take{display:flex;align-items:center;gap:10px;background:#18181b;border:1px solid #27272a;
    border-radius:12px;padding:10px 12px;margin-bottom:10px}
  .take audio{flex:1;height:34px}
  .take .del{background:transparent;color:#f87171;padding:6px 10px;font-size:13px}
  .take .n{color:#71717a;font-size:13px;min-width:20px}
  .muted{color:#71717a;font-size:13px}
  .nav{display:flex;justify-content:space-between;align-items:center;margin:0 0 16px}
  .nav a{color:#60a5fa;text-decoration:none;font-size:15px;padding:6px 4px}
  .glyph{font-size:48px;text-align:center}
  .narrative{white-space:pre-wrap;line-height:1.6;background:#18181b;border:1px solid #27272a;
    border-radius:12px;padding:16px;margin-top:16px}
"""


def _day_nav(signed_date: date_type) -> str:
    """Prev/next-day links. Previous day is always available (past never expires);
    next day only up to today (no navigating into the future)."""
    today = datetime.now(LOCAL_TZ).date()
    prev_d = signed_date - timedelta(days=1)
    prev_lbl = prev_d.strftime("%b ") + str(prev_d.day)
    left = f'<a href="/journal/{sign_journal_token(prev_d.isoformat())}">&larr; {prev_lbl}</a>'
    next_d = signed_date + timedelta(days=1)
    if next_d <= today:
        next_lbl = next_d.strftime("%b ") + str(next_d.day)
        right = f'<a href="/journal/{sign_journal_token(next_d.isoformat())}">{next_lbl} &rarr;</a>'
    else:
        right = "<span></span>"  # keep prev pinned left
    return f'<div class="nav">{left}{right}</div>'


def _shell(heading: str, message: str, ok: bool) -> str:
    accent = "#16a34a" if ok else "#dc2626"
    glyph = "✅" if ok else "⚠️"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>{heading}</title>
<style>{_BASE_CSS} h1{{color:{accent}}}</style></head>
<body><div class="glyph">{glyph}</div><h1 style="text-align:center">{heading}</h1>
<p class="sub" style="text-align:center">{message}</p></body></html>"""


def _read_only_page(pretty: str, entry, nav: str = "") -> str:
    status = entry["status"]
    if entry["narrative"]:
        body = f'<div class="narrative">{_esc(entry["narrative"])}</div>'
    elif status == "submitted":
        body = '<p class="muted">Submitted. Transcribing and weaving your entry, check back soon.</p>'
    else:
        body = '<p class="muted">This day is closed.</p>'
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Journal · {pretty}</title>
<style>{_BASE_CSS}</style></head>
<body>{nav}<h1>{pretty}</h1><p class="sub">Submitted · {status}</p>{body}</body></html>"""


def _recording_page(token: str, signed_date: date_type, pretty: str, nav: str = "") -> str:
    # Token is embedded so the inline JS can hit the token-scoped endpoints.
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Journal · {pretty}</title>
<style>{_BASE_CSS}</style></head>
<body>
{nav}
<h1>{pretty}</h1>
<p class="sub">Talk as much as you want, in as many takes as you want. Submit when you're happy.</p>
<button id="rec" class="rec">● Record</button>
<div id="takes"></div>
<p id="empty" class="muted">No takes yet. Tap Record to start.</p>
<button id="submit" class="submit" disabled>Submit day</button>
<p id="msg" class="muted"></p>
<script>
const TOKEN = {json.dumps(token)};
const DATE = {json.dumps(signed_date.isoformat())};
const base = "/journal/" + encodeURIComponent(TOKEN);
let mediaRecorder, chunks = [], startedAt = 0, recording = false;
let unsentCount = 0;
const recBtn = document.getElementById('rec');
const submitBtn = document.getElementById('submit');
const takesEl = document.getElementById('takes');
const emptyEl = document.getElementById('empty');
const msgEl = document.getElementById('msg');

function fmt(s) {{ if (s == null) return ''; const m = Math.floor(s/60), r = s%60; return m + ':' + String(r).padStart(2,'0'); }}

// ---- Durable take queue ----------------------------------------------------
// Every finished take is written to IndexedDB *before* we attempt to upload it,
// and only removed once the server confirms receipt. A failed upload, a dropped
// connection, a locked phone, or a page reload can therefore no longer destroy
// a recording: it stays on disk and is retried on the next opportunity.
const DB_NAME = 'journal-takes', STORE = 'pending';
let _db;
function db() {{
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, {{ keyPath: 'id' }});
    req.onsuccess = () => {{ _db = req.result; resolve(_db); }};
    req.onerror = () => reject(req.error);
  }});
}}
function tx(mode, fn) {{
  return db().then(d => new Promise((resolve, reject) => {{
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }}));
}}
const idbPut = rec => tx('readwrite', s => s.put(rec));
const idbDel = id => tx('readwrite', s => s.delete(id));
async function pendingForDay() {{
  const all = await tx('readonly', s => s.getAll());
  return (all || []).filter(r => r.token === TOKEN).sort((a, b) => a.createdAt - b.createdAt);
}}

// Upload every queued take for this day. Success → drop from disk. A hard
// server rejection (409, the day is already locked) → mark it so we stop
// retrying but keep the audio for the user to download. Anything else
// (offline, 5xx) → stop and leave it queued for the next retry.
let flushing = false;
async function flush() {{
  if (flushing) return; flushing = true;
  try {{
    for (const rec of await pendingForDay()) {{
      if (rec.blocked) continue;
      const fd = new FormData();
      fd.append('file', rec.blob, 'take' + rec.ext);
      fd.append('duration_sec', rec.dur);
      let r;
      try {{ r = await fetch(base + '/takes', {{ method: 'POST', body: fd }}); }}
      catch (e) {{ break; }}
      if (r.ok) await idbDel(rec.id);
      else if (r.status === 409) {{ rec.blocked = true; await idbPut(rec); }}
      else break;
    }}
  }} finally {{ flushing = false; }}
  await render();
}}

async function render() {{
  let serverTakes = [];
  try {{
    const res = await fetch(base + '/takes');
    if (res.ok) serverTakes = (await res.json()).takes || [];
  }} catch (e) {{}}
  const pend = await pendingForDay();
  takesEl.innerHTML = '';
  serverTakes.forEach(t => {{
    const row = document.createElement('div'); row.className = 'take';
    row.innerHTML = '<span class="n">' + t.sequence + '</span>' +
      '<audio controls preload="none" src="' + base + '/audio/' + t.id + '"></audio>' +
      '<span class="muted">' + fmt(t.duration_sec) + '</span>' +
      '<button class="del" data-id="' + t.id + '">Delete</button>';
    takesEl.appendChild(row);
  }});
  pend.forEach(rec => {{
    const row = document.createElement('div'); row.className = 'take';
    const url = URL.createObjectURL(rec.blob);
    const state = rec.blocked ? '⚠ day locked — download to keep' : '⏳ not uploaded yet';
    row.innerHTML = '<span class="n">•</span>' +
      '<audio controls preload="none" src="' + url + '"></audio>' +
      '<span class="muted">' + fmt(rec.dur) + '</span>' +
      '<a class="del" download="take-' + DATE + rec.ext + '" href="' + url + '">Download</a>' +
      '<span class="muted">' + state + '</span>';
    takesEl.appendChild(row);
  }});
  unsentCount = pend.filter(r => !r.blocked).length;
  const n = serverTakes.length + pend.length;
  emptyEl.style.display = n ? 'none' : 'block';
  submitBtn.disabled = serverTakes.length === 0 || unsentCount > 0;
  msgEl.textContent = unsentCount ? (unsentCount + ' take(s) still uploading…') : stickyMsg;
  takesEl.querySelectorAll('.del[data-id]').forEach(b => b.onclick = () => del(b.dataset.id));
}}

async function del(id) {{
  try {{ await fetch(base + '/takes/' + id, {{ method: 'DELETE' }}); }} catch (e) {{}}
  render();
}}

// Capture interruptions (phone call, Siri, screen lock, app switch) silently
// kill the mic on iOS while the wall clock keeps running — a "281s take" once
// held 19.8s of real audio (journal-12). Defenses: (1) record with a 1s
// timeslice so captured audio is in `chunks`, not stuck inside a dead
// recorder; (2) watch track mute/ended, recorder errors, and page-hide, and
// auto-finalize the take the moment capture dies, with a visible warning;
// (3) count duration only while the mic is actually live.
let liveMs = 0, liveSince = 0, interruptReason = '', stickyMsg = '';

function liveSeconds() {{
  return Math.round((liveMs + (liveSince ? Date.now() - liveSince : 0)) / 1000);
}}

function stopRec(reason) {{
  if (!recording) return;
  recording = false;
  if (reason) interruptReason = reason;
  recBtn.textContent = '● Record'; recBtn.classList.remove('recording');
  try {{ mediaRecorder.stop(); }} catch (e) {{}}
}}

document.addEventListener('visibilitychange', () => {{
  if (document.hidden && recording) stopRec('screen locked or app switched');
}});

async function startRec() {{
  const stream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
  mediaRecorder = new MediaRecorder(stream);
  chunks = []; startedAt = Date.now(); liveMs = 0; liveSince = Date.now(); interruptReason = ''; stickyMsg = '';
  const track = stream.getAudioTracks()[0];
  if (track) {{
    track.onmute = () => {{
      if (liveSince) {{ liveMs += Date.now() - liveSince; liveSince = 0; }}
      // Grace period: a transient mute (notification ping) can recover; a
      // call/lock stays muted. If still muted shortly after, finalize.
      setTimeout(() => {{ if (recording && track.muted) stopRec('mic was interrupted'); }}, 1500);
    }};
    track.onunmute = () => {{ if (!liveSince) liveSince = Date.now(); }};
    track.onended = () => stopRec('mic was disconnected');
  }}
  mediaRecorder.onerror = () => stopRec('recorder error');
  mediaRecorder.ondataavailable = e => {{ if (e.data && e.data.size) chunks.push(e.data); }};
  mediaRecorder.onstop = async () => {{
    if (liveSince) {{ liveMs += Date.now() - liveSince; liveSince = 0; }}
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, {{ type: mediaRecorder.mimeType || 'audio/webm' }});
    const dur = liveSeconds();
    if (!blob.size) {{
      msgEl.textContent = interruptReason
        ? 'Recording failed (' + interruptReason + ') — nothing was captured. Tap Record to try again.'
        : 'Nothing was captured — tap Record to try again.';
      await render(); return;
    }}
    const ext = (blob.type.indexOf('mp4') >= 0) ? '.mp4' : '.webm';
    const rec = {{ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
                   token: TOKEN, blob: blob, dur: dur, ext: ext, createdAt: Date.now() }};
    try {{ await idbPut(rec); }}
    catch (e) {{ msgEl.textContent = 'Could not save recording — do not close this page.'; return; }}
    if (interruptReason) {{
      stickyMsg = 'Recording stopped early — ' + interruptReason + '. The ' + fmt(dur) +
        ' captured so far is saved; tap Record to continue in a new take.';
    }}
    await render();
    flush();
  }};
  mediaRecorder.start(1000);
  recording = true; recBtn.textContent = '■ Stop'; recBtn.classList.add('recording');
}}

recBtn.onclick = async () => {{
  if (!recording) {{
    try {{ await startRec(); }} catch (e) {{ msgEl.textContent = 'Mic access needed.'; }}
  }} else {{
    stopRec('');
  }}
}};

submitBtn.onclick = async () => {{
  if (unsentCount > 0) {{ msgEl.textContent = 'Wait for all takes to finish uploading first.'; return; }}
  if (!confirm('Submit and lock this day? You won\\'t be able to edit takes after this.')) return;
  submitBtn.disabled = true; msgEl.textContent = 'Submitting…';
  let r;
  try {{ r = await fetch(base + '/submit', {{ method: 'POST' }}); }}
  catch (e) {{ msgEl.textContent = 'Submit failed — check your connection.'; submitBtn.disabled = false; return; }}
  if (r.ok) {{ location.reload(); }}
  else {{ msgEl.textContent = 'Submit failed'; submitBtn.disabled = false; }}
}};

// Warn before leaving if any take hasn't reached the server yet (it's safe in
// IndexedDB and will retry on next open, but the warning avoids confusion).
window.addEventListener('beforeunload', e => {{
  if (unsentCount > 0) {{ e.preventDefault(); e.returnValue = ''; }}
}});
window.addEventListener('online', flush);
setInterval(flush, 15000);   // steady background retry for anything stuck
flush();
</script>
</body></html>"""


def _esc(s: str) -> str:
    from html import escape
    return escape(s)


def _vocab_grading_page(token: str) -> str:
    """Vocab grading UI. All data arrives via the /journal/vocab/state JSON
    endpoint and is DOM-injected as text (no HTML interpolation of transcripts)."""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Journal · Vocab</title>
<style>{_BASE_CSS}
  .scanbar{{display:flex;align-items:center;gap:10px;margin-bottom:20px}}
  .scanbar button{{background:#2563eb;color:#fff;font-size:14px;padding:10px 14px}}
  .scanbar button:disabled{{background:#374151;color:#9ca3af}}
  .cand{{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:14px;margin-bottom:12px}}
  .cand .surface{{font-size:17px;font-weight:600}}
  .cand .ctx{{color:#a1a1aa;font-size:13px;font-style:italic;margin:6px 0 10px;line-height:1.45}}
  .cand .meta{{color:#71717a;font-size:12px;margin-left:8px}}
  .badge{{font-size:11px;border-radius:6px;padding:2px 6px;margin-left:8px;vertical-align:middle}}
  .badge.llm{{background:#312e81;color:#c7d2fe}}
  .badge.heuristic{{background:#374151;color:#d1d5db}}
  .badge.audit{{background:#78350f;color:#fde68a}}
  .row{{display:flex;gap:8px;flex-wrap:wrap;align-items:center}}
  input,select{{font:inherit;background:#0b0b0f;color:#f5f5f7;border:1px solid #3f3f46;
    border-radius:8px;padding:8px 10px}}
  input.canon{{width:170px}} input.vars{{flex:1;min-width:140px}}
  .accept{{background:#16a34a;color:#fff;padding:8px 14px;font-size:14px}}
  .reject{{background:transparent;color:#f87171;border:1px solid #7f1d1d;padding:8px 14px;font-size:14px}}
  h2{{font-size:16px;margin:28px 0 10px;color:#a1a1aa}}
  .term{{display:flex;gap:8px;align-items:center;background:#18181b;border:1px solid #27272a;
    border-radius:10px;padding:8px 10px;margin-bottom:8px;flex-wrap:wrap}}
  .term .canonical{{font-weight:600;min-width:120px}}
  .term .variants{{color:#a1a1aa;font-size:13px;flex:1}}
  .term .x{{background:transparent;color:#f87171;padding:4px 8px;font-size:13px}}
  .empty{{color:#71717a;font-size:14px}}
</style></head>
<body>
<h1>Vocab grading</h1>
<p class="sub">Accept a name once and every future transcription and weave knows it.</p>
<div class="scanbar">
  <button id="scan">Scan transcripts</button>
  <span id="scanmsg" class="muted"></span>
</div>
<div id="cands"></div>
<p id="candempty" class="empty" style="display:none">No candidates waiting. 🎉</p>
<h2>Known vocab</h2>
<div class="row" style="margin-bottom:12px">
  <input id="newcanon" class="canon" placeholder="New name">
  <input id="newvars" class="vars" placeholder="mishearings, comma-separated">
  <button class="accept" id="addterm">Add</button>
</div>
<div id="terms"></div>
<script>
const T = {json.dumps(token)};
const q = "?t=" + encodeURIComponent(T);
const candsEl = document.getElementById('cands');
const termsEl = document.getElementById('terms');
const scanBtn = document.getElementById('scan');
const scanMsg = document.getElementById('scanmsg');

async function jget(p) {{ const r = await fetch(p + q); if (!r.ok) throw new Error(r.status); return r.json(); }}
async function jpost(p, body) {{
  const r = await fetch(p + q, {{method:'POST', headers:{{'Content-Type':'application/json'}}, body: JSON.stringify(body||{{}})}});
  if (!r.ok) throw new Error(r.status); return r.json();
}}
function el(tag, cls, text) {{
  const e = document.createElement(tag); if (cls) e.className = cls;
  if (text != null) e.textContent = text; return e;
}}

function candCard(c) {{
  const card = el('div', 'cand');
  const head = el('div');
  head.appendChild(el('span', 'surface', c.surface));
  head.appendChild(el('span', 'badge ' + c.source, c.source));
  if (c.entry_date) head.appendChild(el('span', 'meta', c.entry_date));
  card.appendChild(head);
  if (c.context) card.appendChild(el('div', 'ctx', '"…' + c.context.replace(/^…|…$/g,'') + '…"'));
  const row = el('div', 'row');
  const canon = el('input', 'canon'); canon.value = c.suggestion || c.surface;
  const vars = el('input', 'vars');
  vars.placeholder = 'mishearings, comma-separated';
  if (c.suggestion && c.suggestion.toLowerCase() !== c.surface.toLowerCase()) vars.value = c.surface;
  const cat = el('select');
  ['person','place','other'].forEach(v => {{ const o = el('option', null, v); o.value = v; cat.appendChild(o); }});
  const ok = el('button', 'accept', 'Accept');
  const no = el('button', 'reject', 'Reject');
  ok.onclick = async () => {{
    ok.disabled = no.disabled = true;
    await jpost('/journal/vocab/grade', {{id: c.id, action: 'accept', canonical: canon.value,
      variants: vars.value.split(',').map(s => s.trim()).filter(Boolean), category: cat.value}});
    card.remove(); refreshTermsOnly();
  }};
  no.onclick = async () => {{
    ok.disabled = no.disabled = true;
    await jpost('/journal/vocab/grade', {{id: c.id, action: 'reject'}});
    card.remove();
  }};
  [canon, vars, cat, ok, no].forEach(x => row.appendChild(x));
  card.appendChild(row);
  return card;
}}

function termRow(x) {{
  const row = el('div', 'term');
  row.appendChild(el('span', 'canonical', x.canonical));
  row.appendChild(el('span', 'variants', (x.variants||[]).join(', ') || '—'));
  const del = el('button', 'x', 'remove');
  del.onclick = async () => {{
    if (!confirm('Remove "' + x.canonical + '" from the vocab?')) return;
    await jpost('/journal/vocab/terms', {{action: 'delete', id: x.id}});
    row.remove();
  }};
  row.appendChild(del);
  return row;
}}

async function refreshTermsOnly() {{
  const s = await jget('/journal/vocab/state');
  termsEl.innerHTML = '';
  s.terms.forEach(x => termsEl.appendChild(termRow(x)));
}}

async function refresh() {{
  const s = await jget('/journal/vocab/state');
  candsEl.innerHTML = '';
  s.pending.forEach(c => candsEl.appendChild(candCard(c)));
  document.getElementById('candempty').style.display = s.pending.length ? 'none' : 'block';
  termsEl.innerHTML = '';
  s.terms.forEach(x => termsEl.appendChild(termRow(x)));
  return s;
}}

async function scan() {{
  scanBtn.disabled = true;
  scanMsg.textContent = 'Scanning… (loads the 3B model, ~10s per new transcript)';
  try {{
    const r = await jpost('/journal/vocab/scan');
    scanMsg.textContent = r.scanned ? ('Scanned ' + r.scanned + ' transcript(s), ' + r.new_candidates + ' new candidate(s).')
                                    : 'Nothing new to scan.';
  }} catch (e) {{ scanMsg.textContent = 'Scan failed: ' + e.message; }}
  scanBtn.disabled = false;
  refresh();
}}
scanBtn.onclick = scan;

document.getElementById('addterm').onclick = async () => {{
  const canonical = document.getElementById('newcanon').value.trim();
  if (!canonical) return;
  await jpost('/journal/vocab/terms', {{action: 'add', canonical,
    variants: document.getElementById('newvars').value.split(',').map(s => s.trim()).filter(Boolean)}});
  document.getElementById('newcanon').value = ''; document.getElementById('newvars').value = '';
  refreshTermsOnly();
}};

// On open: show what's already queued immediately, then auto-scan anything new
// (this is the "inference only while grading" trigger).
refresh().then(s => {{ if (s.unscanned > 0) scan(); }});
</script>
</body></html>"""
