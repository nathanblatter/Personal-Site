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
import os
import uuid
from datetime import date as date_type, datetime, timezone
from typing import Optional
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from app.routers.storage import get_s3_client, ensure_bucket, MINIO_BUCKET

log = logging.getLogger("journal")

LOCAL_TZ = ZoneInfo(os.getenv("LOCAL_TZ", "America/Denver"))  # fallback when location lookup fails
KPI_DSN = os.getenv("DATABASE_URL_KPI", "postgresql://postgres:postgres@host.docker.internal:5432/kpi")
SITE_BASE_URL = os.getenv("SITE_BASE_URL", "https://nathanblatter.com")
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
        await c.execute(_CREATE_PROMPT_SUGGESTIONS)
        await c.execute(_CREATE_MAGIC_LINKS)
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


@router.get("/journal/{token}", response_class=HTMLResponse, include_in_schema=False)
async def journal_page(token: str):
    signed_date = verify_journal_token(token)
    if signed_date is None:
        return HTMLResponse(_shell("Invalid link", "This journal link isn't valid.", ok=False),
                            status_code=400, headers=_NO_STORE)
    async with _pool().acquire() as conn:
        entry = await _ensure_entry(conn, signed_date)
    pretty = signed_date.strftime("%A, %B ") + str(signed_date.day)
    if entry["submitted_at"] is not None:
        return HTMLResponse(_read_only_page(pretty, entry), headers=_NO_STORE)
    return HTMLResponse(_recording_page(token, signed_date, pretty), headers=_NO_STORE)


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
    await imessage_service.send_alert(f"{prefix}{label} journal 🎙️ tap to record:\n{url}")
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
  .glyph{font-size:48px;text-align:center}
  .narrative{white-space:pre-wrap;line-height:1.6;background:#18181b;border:1px solid #27272a;
    border-radius:12px;padding:16px;margin-top:16px}
"""


def _shell(heading: str, message: str, ok: bool) -> str:
    accent = "#16a34a" if ok else "#dc2626"
    glyph = "✅" if ok else "⚠️"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>{heading}</title>
<style>{_BASE_CSS} h1{{color:{accent}}}</style></head>
<body><div class="glyph">{glyph}</div><h1 style="text-align:center">{heading}</h1>
<p class="sub" style="text-align:center">{message}</p></body></html>"""


def _read_only_page(pretty: str, entry) -> str:
    status = entry["status"]
    if entry["narrative"]:
        body = f'<div class="narrative">{_esc(entry["narrative"])}</div>'
    elif status == "submitted":
        body = '<p class="muted">Submitted — transcribing and weaving your entry. Check back soon.</p>'
    else:
        body = '<p class="muted">This day is closed.</p>'
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Journal — {pretty}</title>
<style>{_BASE_CSS}</style></head>
<body><h1>{pretty}</h1><p class="sub">Submitted · {status}</p>{body}</body></html>"""


def _recording_page(token: str, signed_date: date_type, pretty: str) -> str:
    # Token is embedded so the inline JS can hit the token-scoped endpoints.
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Journal — {pretty}</title>
<style>{_BASE_CSS}</style></head>
<body>
<h1>{pretty}</h1>
<p class="sub">Talk as much as you want, in as many takes as you want. Submit when you're happy.</p>
<button id="rec" class="rec">● Record</button>
<div id="takes"></div>
<p id="empty" class="muted">No takes yet — tap Record to start.</p>
<button id="submit" class="submit" disabled>Submit day</button>
<p id="msg" class="muted"></p>
<script>
const TOKEN = {json.dumps(token)};
const base = "/journal/" + encodeURIComponent(TOKEN);
let mediaRecorder, chunks = [], startedAt = 0, recording = false;
const recBtn = document.getElementById('rec');
const submitBtn = document.getElementById('submit');
const takesEl = document.getElementById('takes');
const emptyEl = document.getElementById('empty');
const msgEl = document.getElementById('msg');

function fmt(s) {{ if (s == null) return ''; const m = Math.floor(s/60), r = s%60; return m + ':' + String(r).padStart(2,'0'); }}

async function refresh() {{
  const res = await fetch(base + '/takes');
  const data = await res.json();
  takesEl.innerHTML = '';
  (data.takes || []).forEach(t => {{
    const row = document.createElement('div'); row.className = 'take';
    row.innerHTML = '<span class="n">' + t.sequence + '</span>' +
      '<audio controls preload="none" src="' + base + '/audio/' + t.id + '"></audio>' +
      '<span class="muted">' + fmt(t.duration_sec) + '</span>' +
      '<button class="del" data-id="' + t.id + '">Delete</button>';
    takesEl.appendChild(row);
  }});
  const n = (data.takes || []).length;
  emptyEl.style.display = n ? 'none' : 'block';
  submitBtn.disabled = n === 0;
  takesEl.querySelectorAll('.del').forEach(b => b.onclick = () => del(b.dataset.id));
}}

async function del(id) {{
  await fetch(base + '/takes/' + id, {{ method: 'DELETE' }});
  refresh();
}}

async function startRec() {{
  const stream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
  mediaRecorder = new MediaRecorder(stream);
  chunks = []; startedAt = Date.now();
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = async () => {{
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, {{ type: mediaRecorder.mimeType || 'audio/webm' }});
    const dur = Math.round((Date.now() - startedAt) / 1000);
    const ext = (blob.type.indexOf('mp4') >= 0) ? '.mp4' : '.webm';
    const fd = new FormData();
    fd.append('file', blob, 'take' + ext);
    fd.append('duration_sec', dur);
    msgEl.textContent = 'Saving…';
    const r = await fetch(base + '/takes', {{ method: 'POST', body: fd }});
    msgEl.textContent = r.ok ? '' : 'Save failed';
    refresh();
  }};
  mediaRecorder.start();
  recording = true; recBtn.textContent = '■ Stop'; recBtn.classList.add('recording');
}}

recBtn.onclick = async () => {{
  if (!recording) {{
    try {{ await startRec(); }} catch (e) {{ msgEl.textContent = 'Mic access needed.'; }}
  }} else {{
    recording = false; recBtn.textContent = '● Record'; recBtn.classList.remove('recording');
    mediaRecorder.stop();
  }}
}};

submitBtn.onclick = async () => {{
  if (!confirm('Submit and lock this day? You won\\'t be able to edit takes after this.')) return;
  submitBtn.disabled = true; msgEl.textContent = 'Submitting…';
  const r = await fetch(base + '/submit', {{ method: 'POST' }});
  if (r.ok) {{ location.reload(); }}
  else {{ msgEl.textContent = 'Submit failed'; submitBtn.disabled = false; }}
}};

refresh();
</script>
</body></html>"""


def _esc(s: str) -> str:
    from html import escape
    return escape(s)
