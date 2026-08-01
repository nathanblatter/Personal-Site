"""KPI router — exposes site analytics metrics for external dashboards."""

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
import httpx
import asyncpg
from datetime import date as date_type, datetime, time as time_type, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Header, Form, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app import imessage_service

log = logging.getLogger("kpi")

router = APIRouter(prefix="/kpi", tags=["kpi"])

# ---------------------------------------------------------------------------
# Health Ingest — separate router registered at /api (not /api/v1)
# ---------------------------------------------------------------------------

_KPI_POOL: asyncpg.Pool | None = None

_ALLOWED_FIELDS = frozenset({
    # --- HealthKit-mined metrics (phone Shortcut) ---
    "resting_hr", "hrv_morning", "avg_heart_rate", "max_heart_rate",
    "min_heart_rate", "walking_hr_avg", "cardio_recovery",
    "sleep_hrs", "sleep_bedtime", "sleep_deep_hrs", "sleep_rem_hrs",
    "sleep_core_hrs", "sleep_awake_hrs",
    "steps", "active_cal", "resting_energy_cal", "walking_distance_mi",
    "flights_climbed", "exercise_minutes", "stand_hours",
    "workout_type", "workout_duration_min",
    "respiratory_rate", "blood_oxygen", "vo2_max",
    "body_fat_pct", "lean_body_mass_lbs", "wrist_temp_c",
    "mindful_minutes", "time_in_daylight_min", "headphone_audio_db",
    # --- behavioural / self-report / scraped ---
    "energy_am", "prayer_am", "prayer_pm", "scripture", "church",
    "temple", "meaningful_convos", "new_people", "deep_work_hrs",
    "ideas_count", "lc_solved", "github_commits", "github_prs",
    "life_sat", "notes", "instagram_pickups",
})

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS kpi_daily_log (
    date                DATE PRIMARY KEY,
    resting_hr          NUMERIC,
    hrv_morning         NUMERIC,
    sleep_hrs           NUMERIC,
    sleep_bedtime       TIME,
    steps               INTEGER,
    active_cal          INTEGER,
    workout_type        TEXT,
    workout_duration_min INTEGER,
    sleep_deep_hrs      NUMERIC,
    sleep_rem_hrs       NUMERIC,
    sleep_core_hrs      NUMERIC,
    sleep_awake_hrs     NUMERIC,
    respiratory_rate    NUMERIC,
    blood_oxygen        NUMERIC,
    vo2_max             NUMERIC,
    resting_energy_cal  INTEGER,
    walking_distance_mi NUMERIC,
    flights_climbed     INTEGER,
    exercise_minutes    INTEGER,
    stand_hours         INTEGER,
    avg_heart_rate      NUMERIC,
    max_heart_rate      NUMERIC,
    min_heart_rate      NUMERIC,
    walking_hr_avg      NUMERIC,
    cardio_recovery     NUMERIC,
    mindful_minutes     INTEGER,
    body_fat_pct        NUMERIC,
    lean_body_mass_lbs  NUMERIC,
    wrist_temp_c        NUMERIC,
    time_in_daylight_min INTEGER,
    headphone_audio_db  NUMERIC,
    energy_am           SMALLINT CHECK (energy_am BETWEEN 1 AND 10),
    prayer_am           BOOLEAN,
    prayer_pm           BOOLEAN,
    scripture           BOOLEAN,
    church              BOOLEAN,
    temple              BOOLEAN,
    meaningful_convos   INTEGER,
    new_people          INTEGER,
    deep_work_hrs       NUMERIC,
    ideas_count         INTEGER,
    lc_solved           INTEGER,
    github_commits      INTEGER,
    github_prs          INTEGER,
    life_sat            SMALLINT CHECK (life_sat BETWEEN 1 AND 10),
    notes               TEXT,
    instagram_pickups   INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
"""

_CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION update_kpi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_DROP_TRIGGER = "DROP TRIGGER IF EXISTS kpi_daily_log_updated_at ON kpi_daily_log;"

_CREATE_TRIGGER = """
CREATE TRIGGER kpi_daily_log_updated_at
    BEFORE UPDATE ON kpi_daily_log
    FOR EACH ROW EXECUTE FUNCTION update_kpi_updated_at();
"""


async def init_kpi_db() -> None:
    global _KPI_POOL
    kpi_url = os.getenv(
        "DATABASE_URL_KPI",
        "postgresql://postgres:postgres@host.docker.internal:5432/kpi",
    )
    # Connect to postgres DB to create kpi database if needed
    parsed = urlparse(kpi_url)
    admin_url = urlunparse(parsed._replace(path="/postgres"))
    conn = await asyncpg.connect(admin_url)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'kpi'")
        if not exists:
            await conn.execute("CREATE DATABASE kpi")
    finally:
        await conn.close()

    _KPI_POOL = await asyncpg.create_pool(kpi_url)
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(_CREATE_TABLE)
        await conn.execute(_CREATE_FUNCTION)
        await conn.execute(_DROP_TRIGGER)
        await conn.execute(_CREATE_TRIGGER)
        # Additive migrations for new columns
        await conn.execute(
            "ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS instagram_pickups INTEGER DEFAULT 0"
        )
        # Post-workout weigh-in: weight + derived BMI, plus the magic-link scheduling state.
        await conn.execute("ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC")
        await conn.execute("ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS bmi NUMERIC")
        await conn.execute("ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS weight_due_at TIMESTAMPTZ")
        await conn.execute("ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS weight_reminded_at TIMESTAMPTZ")
        # Expanded HealthKit-mined metrics (phone Shortcut posts these to /health-ingest).
        # Additive + idempotent; matches the columns in _ALLOWED_FIELDS / HealthIngestRequest.
        for _col, _type in (
            ("sleep_hrs", "NUMERIC"), ("sleep_bedtime", "TIME"),
            ("sleep_deep_hrs", "NUMERIC"), ("sleep_rem_hrs", "NUMERIC"),
            ("sleep_core_hrs", "NUMERIC"), ("sleep_awake_hrs", "NUMERIC"),
            ("workout_duration_min", "INTEGER"),
            ("respiratory_rate", "NUMERIC"), ("blood_oxygen", "NUMERIC"),
            ("vo2_max", "NUMERIC"), ("resting_energy_cal", "INTEGER"),
            ("walking_distance_mi", "NUMERIC"), ("flights_climbed", "INTEGER"),
            ("exercise_minutes", "INTEGER"), ("stand_hours", "INTEGER"),
            ("avg_heart_rate", "NUMERIC"), ("max_heart_rate", "NUMERIC"),
            ("min_heart_rate", "NUMERIC"), ("walking_hr_avg", "NUMERIC"),
            ("cardio_recovery", "NUMERIC"), ("mindful_minutes", "INTEGER"),
            ("body_fat_pct", "NUMERIC"), ("lean_body_mass_lbs", "NUMERIC"),
            ("wrist_temp_c", "NUMERIC"), ("time_in_daylight_min", "INTEGER"),
            ("headphone_audio_db", "NUMERIC"),
        ):
            await conn.execute(
                f"ALTER TABLE kpi_daily_log ADD COLUMN IF NOT EXISTS {_col} {_type}"
            )
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS location_log (
                id        BIGSERIAL PRIMARY KEY,
                ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                lat       DOUBLE PRECISION NOT NULL,
                lon       DOUBLE PRECISION NOT NULL
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS location_log_ts_idx ON location_log (ts)"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS resolved_location TEXT"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS street TEXT"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS city TEXT"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS zip TEXT"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS region TEXT"
        )
        await conn.execute(
            "ALTER TABLE location_log ADD COLUMN IF NOT EXISTS state TEXT"
        )


async def close_kpi_db() -> None:
    global _KPI_POOL
    if _KPI_POOL:
        await _KPI_POOL.close()
        _KPI_POOL = None


class HealthIngestRequest(BaseModel):
    date: Optional[date_type] = None
    resting_hr: Optional[float] = None
    hrv_morning: Optional[float] = None
    avg_heart_rate: Optional[float] = None
    max_heart_rate: Optional[float] = None
    min_heart_rate: Optional[float] = None
    walking_hr_avg: Optional[float] = None
    cardio_recovery: Optional[float] = None
    sleep_hrs: Optional[float] = None
    sleep_bedtime: Optional[time_type] = None
    sleep_deep_hrs: Optional[float] = None
    sleep_rem_hrs: Optional[float] = None
    sleep_core_hrs: Optional[float] = None
    sleep_awake_hrs: Optional[float] = None
    steps: Optional[int] = None
    active_cal: Optional[int] = None
    resting_energy_cal: Optional[int] = None
    walking_distance_mi: Optional[float] = None
    flights_climbed: Optional[int] = None
    exercise_minutes: Optional[int] = None
    stand_hours: Optional[int] = None
    workout_type: Optional[str] = None
    workout_duration_min: Optional[int] = None
    respiratory_rate: Optional[float] = None
    blood_oxygen: Optional[float] = None
    vo2_max: Optional[float] = None
    body_fat_pct: Optional[float] = None
    lean_body_mass_lbs: Optional[float] = None
    wrist_temp_c: Optional[float] = None
    mindful_minutes: Optional[int] = None
    time_in_daylight_min: Optional[int] = None
    headphone_audio_db: Optional[float] = None
    energy_am: Optional[int] = None
    prayer_am: Optional[bool] = None
    prayer_pm: Optional[bool] = None
    scripture: Optional[bool] = None
    church: Optional[bool] = None
    temple: Optional[bool] = None
    meaningful_convos: Optional[int] = None
    new_people: Optional[int] = None
    deep_work_hrs: Optional[float] = None
    ideas_count: Optional[int] = None
    lc_solved: Optional[int] = None
    github_commits: Optional[int] = None
    github_prs: Optional[int] = None
    life_sat: Optional[int] = None
    notes: Optional[str] = None
    instagram_pickups: Optional[int] = None


class WorkoutIngestRequest(BaseModel):
    workout_type: str
    notes: Optional[str] = None


health_ingest_router = APIRouter(tags=["kpi"])


def _verify_health_ingest_key(x_api_key: Optional[str] = Header(None)) -> None:
    if x_api_key != os.getenv("HEALTH_INGEST_API_KEY"):
        raise HTTPException(status_code=401, detail="Unauthorized")


@health_ingest_router.post("/health-ingest")
async def health_ingest(
    body: HealthIngestRequest,
    _: None = Depends(_verify_health_ingest_key),
):
    target_date = body.date or date_type.today()
    payload = body.model_dump(exclude={"date"})
    fields_to_update = {k: v for k, v in payload.items() if v is not None and k in _ALLOWED_FIELDS}

    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            "INSERT INTO kpi_daily_log (date) VALUES ($1) ON CONFLICT (date) DO NOTHING",
            target_date,
        )
        if fields_to_update:
            cols = list(fields_to_update.keys())
            vals = list(fields_to_update.values())
            set_clause = ", ".join(f"{col} = ${i + 2}" for i, col in enumerate(cols))
            await conn.execute(
                f"UPDATE kpi_daily_log SET {set_clause} WHERE date = $1",
                target_date,
                *vals,
            )

    return {
        "status": "ok",
        "date": target_date.isoformat(),
        "fields_updated": list(fields_to_update.keys()),
    }


# ---------------------------------------------------------------------------
# Apple Shortcut daily ingest — forgiving, stringly-typed, Mountain-time dated
# ---------------------------------------------------------------------------
#
# The end-of-day (11:50pm MT) Shortcut POSTs a flat JSON object of the day's KPI
# values. Everything arrives as strings ("124"), keys may drop underscores
# ("activecal"), and HealthKit quantities can carry extra sample lines
# ("24.95\n0"). This endpoint normalizes keys, coerces each value to its column
# type, and upserts into today's row (Mountain time) — inserting a null-filled
# row first, then dropping in only the fields that were sent. Same X-API-KEY as
# the other ingest endpoints.

_KPI_INT_FIELDS = frozenset({
    "steps", "active_cal", "workout_duration_min", "meaningful_convos",
    "new_people", "ideas_count", "lc_solved", "github_commits", "github_prs",
    "instagram_pickups", "energy_am", "life_sat",
})
_KPI_FLOAT_FIELDS = frozenset({
    "resting_hr", "hrv_morning", "sleep_hrs", "deep_work_hrs", "weight_lbs", "bmi",
})
_KPI_BOOL_FIELDS = frozenset({
    "prayer_am", "prayer_pm", "scripture", "church", "temple",
})
_KPI_TIME_FIELDS = frozenset({"sleep_bedtime"})
_KPI_TEXT_FIELDS = frozenset({"workout_type", "notes"})
# SMALLINT columns with a CHECK (val BETWEEN 1 AND 10); clamp so a stray value
# can't 500 the whole request.
_KPI_CLAMP_1_10 = frozenset({"energy_am", "life_sat"})

_KPI_COLUMNS = (
    _KPI_INT_FIELDS | _KPI_FLOAT_FIELDS | _KPI_BOOL_FIELDS
    | _KPI_TIME_FIELDS | _KPI_TEXT_FIELDS
)
# alnum-only lowercase -> real column, so "activecal"/"active_cal"/"ActiveCal" match.
_KPI_NORM_TO_COL = {re.sub(r"[^a-z0-9]", "", c.lower()): c for c in _KPI_COLUMNS}
# Aliases for keys whose words are ordered differently than the column name, so
# alnum-matching alone can't reach them (e.g. Shortcut sends "morninghrv" but the
# column is hrv_morning). Keys here are already alnum-normalized.
_KPI_NORM_TO_COL.update({
    "morninghrv": "hrv_morning",
})

_KPI_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")


def _kpi_first_number(raw) -> Optional[float]:
    """First numeric token in the value. HealthKit can append extra sample
    lines (e.g. "24.95\\n0"); we take 24.95 and disregard the rest."""
    m = _KPI_NUM_RE.search(str(raw))
    return float(m.group()) if m else None


def _kpi_coerce_bool(raw) -> Optional[bool]:
    s = str(raw).strip().lower()
    if s in {"true", "1", "yes", "y", "on"}:
        return True
    if s in {"false", "0", "no", "n", "off"}:
        return False
    return None


def _kpi_coerce_time(raw) -> Optional[time_type]:
    s = str(raw).strip()
    try:
        return time_type.fromisoformat(s)  # "23:15" or "23:15:00"
    except ValueError:
        m = re.search(r"(\d{1,2}):(\d{2})", s)
        if m:
            return time_type(int(m.group(1)) % 24, int(m.group(2)))
    return None


def _kpi_coerce(col: str, raw):
    """Coerce a raw (usually string) Shortcut value to the column's type.
    Empty / unparseable -> None, which means 'leave it null / untouched'."""
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None
    if col in _KPI_INT_FIELDS:
        n = _kpi_first_number(raw)
        if n is None:
            return None
        n = int(round(n))
        if col in _KPI_CLAMP_1_10:
            n = max(1, min(10, n))
        return n
    if col in _KPI_FLOAT_FIELDS:
        n = _kpi_first_number(raw)
        if n is None:
            return None
        # Quantize as Decimal so the NUMERIC column stores exactly 98.17, not the
        # binary-float tail a Python float would carry in (98.170000000000017).
        return Decimal(str(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if col in _KPI_BOOL_FIELDS:
        return _kpi_coerce_bool(raw)
    if col in _KPI_TIME_FIELDS:
        return _kpi_coerce_time(raw)
    return str(raw).strip()  # text


@health_ingest_router.post("/shortcut-ingest")
async def shortcut_ingest(request: Request, _: None = Depends(_verify_health_ingest_key)):
    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="body must be a JSON object")
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="body must be a JSON object")

    # Date: an explicit `date` wins (backfill/testing); otherwise today in
    # Mountain time so the 11:50pm run never rolls into tomorrow (UTC would).
    explicit = raw.pop("date", None)
    if explicit not in (None, ""):
        try:
            target_date = date_type.fromisoformat(str(explicit)[:10])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"bad date: {explicit!r}")
    else:
        target_date = datetime.now(LOCAL_TZ).date()

    fields: dict = {}
    ignored: list[str] = []
    for key, val in raw.items():
        col = _KPI_NORM_TO_COL.get(re.sub(r"[^a-z0-9]", "", str(key).lower()))
        if not col:
            ignored.append(key)
            continue
        coerced = _kpi_coerce(col, val)
        if coerced is None:
            continue
        fields[col] = coerced

    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            "INSERT INTO kpi_daily_log (date) VALUES ($1) ON CONFLICT (date) DO NOTHING",
            target_date,
        )
        if fields:
            cols = list(fields.keys())
            vals = list(fields.values())
            set_clause = ", ".join(f"{c} = ${i + 2}" for i, c in enumerate(cols))
            await conn.execute(
                f"UPDATE kpi_daily_log SET {set_clause} WHERE date = $1",
                target_date,
                *vals,
            )

    log.info("shortcut_ingest %s: set %s, ignored %s", target_date, fields, ignored)
    return {
        "status": "ok",
        "date": target_date.isoformat(),
        "fields_updated": fields,
        "ignored": ignored,
    }


@health_ingest_router.post("/instagram-pickup")
async def instagram_pickup(_: None = Depends(_verify_health_ingest_key)):
    """Increment today's Instagram pickup count by 1. Called by phone Shortcut on app open."""
    today = date_type.today()
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, instagram_pickups)
            VALUES ($1, 1)
            ON CONFLICT (date) DO UPDATE
              SET instagram_pickups = COALESCE(kpi_daily_log.instagram_pickups, 0) + 1
            """,
            today,
        )
        count = await conn.fetchval(
            "SELECT instagram_pickups FROM kpi_daily_log WHERE date = $1", today
        )
    return {"status": "ok", "date": today.isoformat(), "instagram_pickups_today": count}

@health_ingest_router.post("/workout")
async def workout_completion(
        body: WorkoutIngestRequest,
        _: None = Depends(_verify_health_ingest_key),
):
    """Store today's workout type and append optional notes without overwriting existing notes."""
    today = date_type.today()
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, workout_type, notes)
            VALUES ($1, $2, $3)
            ON CONFLICT (date) DO UPDATE
              SET workout_type = CASE
                    WHEN kpi_daily_log.workout_type IS NULL OR kpi_daily_log.workout_type = ''
                    THEN EXCLUDED.workout_type
                    -- Don't re-append a type that's already logged today (no "gym, gym, gym…").
                    WHEN EXCLUDED.workout_type = ANY (string_to_array(kpi_daily_log.workout_type, ', '))
                    THEN kpi_daily_log.workout_type
                    ELSE kpi_daily_log.workout_type || ', ' || EXCLUDED.workout_type
                END,
                notes = CASE
                    WHEN EXCLUDED.notes IS NULL OR EXCLUDED.notes = '' THEN kpi_daily_log.notes
                    WHEN kpi_daily_log.notes IS NULL OR kpi_daily_log.notes = '' THEN EXCLUDED.notes
                    ELSE kpi_daily_log.notes || E'\n' || EXCLUDED.notes
                END
            """,
            today,
            body.workout_type,
            body.notes,
        )
        count = await conn.fetchval(
            "SELECT workout_type FROM kpi_daily_log WHERE date = $1", today
        )
        # Schedule a one-shot weigh-in nudge ~30 min out — but only if weight isn't
        # already logged today and nothing is already pending/sent (no nagging on a
        # second workout the same day).
        await conn.execute(
            """
            UPDATE kpi_daily_log
               SET weight_due_at = NOW() + INTERVAL '30 minutes'
             WHERE date = $1
               AND weight_lbs IS NULL
               AND weight_due_at IS NULL
               AND weight_reminded_at IS NULL
            """,
            today,
        )
    return {"status": "ok", "date": today.isoformat(), "workout_type": count}

@health_ingest_router.post("/temple")
async def temple_visit(_: None = Depends(_verify_health_ingest_key)):
    """Mark today's temple visit as true. Called by phone Shortcut on app open."""
    today = date_type.today()
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, temple)
            VALUES ($1, TRUE)
            ON CONFLICT (date) DO UPDATE
              SET temple = TRUE
            """,
            today,
        )
        count = await conn.fetchval(
            "SELECT temple FROM kpi_daily_log WHERE date = $1", today
        )
    return {"status": "ok", "date": today.isoformat(), "temple": count}


@health_ingest_router.post("/prayer")
async def prayer_logged(_: None = Depends(_verify_health_ingest_key)):
    """Log a prayer with one button. Picks prayer_am vs prayer_pm from the wall
    clock in Salt Lake (Mountain) time: before noon -> am, noon or later -> pm.
    Date + hour come from the same LOCAL_TZ instant so a late-night tap lands on
    the right day and slot."""
    now = datetime.now(LOCAL_TZ)
    today = now.date()
    column = "prayer_am" if now.hour < 12 else "prayer_pm"
    # column is one of two hardcoded literals, never user input -> safe to inline.
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO kpi_daily_log (date, {column})
            VALUES ($1, TRUE)
            ON CONFLICT (date) DO UPDATE
              SET {column} = TRUE
            """,
            today,
        )
    return {
        "status": "ok",
        "date": today.isoformat(),
        "slot": "am" if column == "prayer_am" else "pm",
        "logged_at": now.strftime("%H:%M %Z"),
    }


# ---------------------------------------------------------------------------
# Church check-in — magic link (no API key; auth is the signed token itself)
# ---------------------------------------------------------------------------
#
# Flow: a weekly background task (Sunday ~5pm) texts Nathan a one-tap link via
# the iMessage gateway. Tapping it hits GET /c/{token}, which verifies an HMAC
# over the date and marks church=true for that day. natebot stays out of it —
# this is the single writer of the church KPI (besides the manual /kpi church
# fallback). Idempotent: tapping twice just re-sets true.

CHURCH_LINK_SECRET = os.getenv("CHURCH_LINK_SECRET", "")
SITE_BASE_URL = os.getenv("SITE_BASE_URL", "https://nathanblatter.com")
# Hour (local time) to send the Sunday reminder; 17 = 5pm.
CHURCH_REMINDER_HOUR = int(os.getenv("CHURCH_REMINDER_HOUR", "17"))

# In-memory guard so the supervised loop texts at most once per day.
_last_church_reminder: Optional[date_type] = None

church_link_router = APIRouter(tags=["kpi"])


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _church_signature(date_str: str) -> str:
    sig = hmac.new(CHURCH_LINK_SECRET.encode(), date_str.encode(), hashlib.sha256).digest()
    return _b64url_encode(sig)


def sign_church_token(date_str: str) -> str:
    return f"{_b64url_encode(date_str.encode())}.{_church_signature(date_str)}"


def verify_church_token(token: str) -> Optional[date_type]:
    """Return the signed date if the token is valid, else None."""
    if not CHURCH_LINK_SECRET:
        return None
    try:
        payload_b64, sig = token.split(".", 1)
        date_str = _b64url_decode(payload_b64).decode()
        if not hmac.compare_digest(_church_signature(date_str), sig):
            return None
        return date_type.fromisoformat(date_str)
    except Exception:
        return None


def _church_page(heading: str, message: str, ok: bool) -> str:
    accent = "#16a34a" if ok else "#dc2626"
    glyph = "✅" if ok else "⚠️"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{heading}</title>
<style>
  html,body{{height:100%;margin:0}}
  body{{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0b0b0f;color:#f5f5f7;text-align:center;padding:24px}}
  .card{{max-width:380px}}
  .glyph{{font-size:56px;line-height:1}}
  h1{{font-size:22px;margin:18px 0 8px;color:{accent}}}
  p{{font-size:16px;color:#a1a1aa;margin:0}}
</style></head>
<body><div class="card">
  <div class="glyph">{glyph}</div>
  <h1>{heading}</h1>
  <p>{message}</p>
</div></body></html>"""


_NO_STORE = {"Cache-Control": "no-store"}


@church_link_router.get("/c/{token}", response_class=HTMLResponse, include_in_schema=False)
async def church_checkin(token: str):
    signed_date = verify_church_token(token)
    if signed_date is None:
        return HTMLResponse(
            _church_page("Invalid link", "This check-in link isn't valid.", ok=False),
            status_code=400,
            headers=_NO_STORE,
        )

    # Only honor links for the last few days, so an old text can't be replayed later.
    today = datetime.now(LOCAL_TZ).date()
    if abs((today - signed_date).days) > 2:
        return HTMLResponse(
            _church_page("Link expired", "This check-in link is no longer valid.", ok=False),
            status_code=410,
            headers=_NO_STORE,
        )

    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, church)
            VALUES ($1, TRUE)
            ON CONFLICT (date) DO UPDATE SET church = TRUE
            """,
            signed_date,
        )

    pretty = signed_date.strftime("%A, %B ") + str(signed_date.day)
    return HTMLResponse(
        _church_page("Logged", f"Church recorded for {pretty}. 🙏", ok=True),
        headers=_NO_STORE,
    )


# How many hours after CHURCH_REMINDER_HOUR the reminder may still fire on Sunday.
# A window (not an exact hour) so a deploy/restart inside the 5pm hour, or event-loop
# lag, doesn't make the reminder miss the whole week.
CHURCH_REMINDER_WINDOW_HOURS = int(os.getenv("CHURCH_REMINDER_WINDOW_HOURS", "4"))


async def send_church_reminder(force: bool = False) -> str:
    """Text the Sunday church magic link, at most once per Sunday.

    Runs on a short supervised interval. On Sunday it fires once any time within
    [CHURCH_REMINDER_HOUR, +WINDOW); the DB check (already-logged) and the in-memory
    day-guard keep it to a single send. `force=True` bypasses the day/window/guard
    checks for manual end-to-end testing.
    """
    global _last_church_reminder
    now = datetime.now(LOCAL_TZ)
    today = now.date()

    if not force:
        if now.weekday() != 6:          # 6 = Sunday
            return "skip: not sunday"
        window_end = CHURCH_REMINDER_HOUR + CHURCH_REMINDER_WINDOW_HOURS
        if not (CHURCH_REMINDER_HOUR <= now.hour < window_end):
            return "skip: outside send window"
        if _last_church_reminder == today:
            return "skip: already sent today"

    if not CHURCH_LINK_SECRET:
        log.warning("CHURCH_LINK_SECRET not set — cannot send church reminder")
        return "skip: no secret configured"

    if not force:
        async with _KPI_POOL.acquire() as conn:
            already = await conn.fetchval(
                "SELECT church FROM kpi_daily_log WHERE date = $1", today
            )
        if already:
            _last_church_reminder = today
            return "skip: church already logged"

    url = f"{SITE_BASE_URL}/c/{sign_church_token(today.isoformat())}"
    prefix = "[test] " if force else ""
    await imessage_service.send_alert(
        f"{prefix}Did you make it to church today? Tap to log it 🙏\n{url}"
    )
    if not force:
        _last_church_reminder = today
    result = f"sent church reminder for {today.isoformat()}"
    return f"{result} (test)" if force else result


# ---------------------------------------------------------------------------
# Post-workout weigh-in — magic link (signed token, no API key)
# ---------------------------------------------------------------------------
#
# Flow: logging a workout (POST /workout) arms a weigh-in ~30 min out by setting
# weight_due_at on today's row (only when no weight is logged and nothing is
# already pending). A short supervised loop (send_weight_reminders) texts a
# one-tap magic link when due, then marks weight_reminded_at so it fires once.
# Tapping GET /w/{token} serves a 1-field form; POST /w/{token} stores the weight
# and computes BMI. Token is an HMAC over the date, valid for a couple of days.

WEIGHT_LINK_SECRET = os.getenv("WEIGHT_LINK_SECRET", "") or CHURCH_LINK_SECRET
# Height in metres for BMI (200 cm). 6'7" ≈ 2.0066 m; 200 cm is close enough.
HEIGHT_M = float(os.getenv("HEIGHT_CM", "200")) / 100.0

weight_link_router = APIRouter(tags=["kpi"])


def _weight_signature(date_str: str) -> str:
    sig = hmac.new(WEIGHT_LINK_SECRET.encode(), b"weight:" + date_str.encode(), hashlib.sha256).digest()
    return _b64url_encode(sig)


def sign_weight_token(date_str: str) -> str:
    return f"{_b64url_encode(date_str.encode())}.{_weight_signature(date_str)}"


def verify_weight_token(token: str) -> Optional[date_type]:
    """Return the signed date if the token is valid, else None."""
    if not WEIGHT_LINK_SECRET:
        return None
    try:
        payload_b64, sig = token.split(".", 1)
        date_str = _b64url_decode(payload_b64).decode()
        if not hmac.compare_digest(_weight_signature(date_str), sig):
            return None
        return date_type.fromisoformat(date_str)
    except Exception:
        return None


def _bmi_from_lbs(weight_lbs: float) -> float:
    kg = weight_lbs * 0.45359237
    return round(kg / (HEIGHT_M * HEIGHT_M), 1)


def _weight_form_page(token: str, pretty: str, error: str = "") -> str:
    err_html = f'<p class="err">{error}</p>' if error else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Weigh in</title>
<style>
  html,body{{height:100%;margin:0}}
  body{{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0b0b0f;color:#f5f5f7;text-align:center;padding:24px}}
  .card{{max-width:340px;width:100%}}
  .glyph{{font-size:48px;line-height:1}}
  h1{{font-size:22px;margin:16px 0 4px}}
  p.sub{{font-size:14px;color:#a1a1aa;margin:0 0 24px}}
  input{{width:100%;box-sizing:border-box;font-size:28px;text-align:center;
    padding:16px;border-radius:14px;border:1px solid #2a2a32;background:#15151b;
    color:#f5f5f7;-webkit-appearance:none;outline:none}}
  input:focus{{border-color:#3b6cf5}}
  button{{width:100%;margin-top:16px;font-size:16px;font-weight:600;padding:16px;
    border:0;border-radius:14px;background:#3b6cf5;color:#fff}}
  .err{{color:#f87171;font-size:13px;margin:12px 0 0}}
</style></head>
<body><div class="card">
  <div class="glyph">💪</div>
  <h1>Weigh-in</h1>
  <p class="sub">Post-workout · {pretty}</p>
  <form method="post" action="/w/{token}">
    <input name="weight_lbs" type="number" step="0.1" min="50" max="600"
      inputmode="decimal" placeholder="Weight (lbs)" autofocus required>
    <button type="submit">Log it</button>
    {err_html}
  </form>
</div></body></html>"""


@weight_link_router.get("/w/{token}", response_class=HTMLResponse, include_in_schema=False)
async def weight_form(token: str):
    signed_date = verify_weight_token(token)
    if signed_date is None:
        return HTMLResponse(
            _church_page("Invalid link", "This weigh-in link isn't valid.", ok=False),
            status_code=400, headers=_NO_STORE,
        )
    today = datetime.now(LOCAL_TZ).date()
    if abs((today - signed_date).days) > 2:
        return HTMLResponse(
            _church_page("Link expired", "This weigh-in link is no longer valid.", ok=False),
            status_code=410, headers=_NO_STORE,
        )
    pretty = signed_date.strftime("%A, %B ") + str(signed_date.day)
    return HTMLResponse(_weight_form_page(token, pretty), headers=_NO_STORE)


@weight_link_router.post("/w/{token}", response_class=HTMLResponse, include_in_schema=False)
async def weight_submit(token: str, weight_lbs: float = Form(...)):
    signed_date = verify_weight_token(token)
    if signed_date is None:
        return HTMLResponse(
            _church_page("Invalid link", "This weigh-in link isn't valid.", ok=False),
            status_code=400, headers=_NO_STORE,
        )
    today = datetime.now(LOCAL_TZ).date()
    if abs((today - signed_date).days) > 2:
        return HTMLResponse(
            _church_page("Link expired", "This weigh-in link is no longer valid.", ok=False),
            status_code=410, headers=_NO_STORE,
        )
    pretty = signed_date.strftime("%A, %B ") + str(signed_date.day)
    if not (50 <= weight_lbs <= 600):
        return HTMLResponse(
            _weight_form_page(token, pretty, "Enter a weight between 50 and 600 lbs."),
            status_code=400, headers=_NO_STORE,
        )

    bmi = _bmi_from_lbs(weight_lbs)
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, weight_lbs, bmi, weight_due_at)
            VALUES ($1, $2, $3, NULL)
            ON CONFLICT (date) DO UPDATE
              SET weight_lbs = EXCLUDED.weight_lbs,
                  bmi = EXCLUDED.bmi,
                  weight_due_at = NULL
            """,
            signed_date, weight_lbs, bmi,
        )
    return HTMLResponse(
        _church_page("Logged", f"{weight_lbs:g} lbs · BMI {bmi} recorded for {pretty}. 💪", ok=True),
        headers=_NO_STORE,
    )


async def send_weight_reminders() -> str:
    """Text the weigh-in magic link for any day whose 30-min timer is due.

    Runs on a short supervised interval. Fires once per armed day (the
    weight_reminded_at stamp is the guard), and never if weight is already logged.
    """
    if not _KPI_POOL:
        return "skip: no pool"
    if not WEIGHT_LINK_SECRET:
        return "skip: no secret configured"

    async with _KPI_POOL.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT date FROM kpi_daily_log
             WHERE weight_due_at IS NOT NULL
               AND weight_due_at <= NOW()
               AND weight_lbs IS NULL
               AND weight_reminded_at IS NULL
            """
        )
        for r in rows:
            d = r["date"]
            url = f"{SITE_BASE_URL}/w/{sign_weight_token(d.isoformat())}"
            await imessage_service.send_alert(
                f"Post-workout check-in 💪 Tap to log your weight:\n{url}"
            )
            await conn.execute(
                "UPDATE kpi_daily_log SET weight_reminded_at = NOW() WHERE date = $1", d
            )

    return f"sent {len(rows)} weight reminder(s)"


class LocationIngestRequest(BaseModel):
    lat: float
    lon: float
    street: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    ts: Optional[datetime] = None


@health_ingest_router.post("/location")
async def location_ingest(
    body: LocationIngestRequest,
    _: None = Depends(_verify_health_ingest_key),
):
    """Log a lat/lon ping. Called by phone Shortcut every 30 minutes."""
    log.info("location_ingest received: %s", body.model_dump())
    ts = body.ts or datetime.now(timezone.utc)
    resolved_location = f"{body.street}, {body.city}, {body.state} {str(body.zip)}, {body.region}"
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            "INSERT INTO location_log (ts, lat, lon, resolved_location, street, city, zip, state, region) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            ts, body.lat, body.lon, resolved_location, body.street, body.city, body.zip, body.state, body.region,
        )
    return {
        "status": "ok",
        "ts": ts.isoformat(),
        "lat": body.lat,
        "lon": body.lon,
        "resolved_location": resolved_location,
        "street": body.street,
        "city": body.city,
        "zip": body.zip,
        "state": body.state,
        "region": body.region,
    }


GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "nathanzbl")
LOCAL_TZ = ZoneInfo(os.getenv("TZ", "America/Denver"))


async def scrape_github_kpi() -> dict[str, int]:
    """Fetch today's GitHub commits and opened PRs from the Events API, upsert into kpi_daily_log.

    Returns dict of {date_str: {"commits": n, "prs": n}} for days updated.
    """
    if not _KPI_POOL:
        return {}

    async with httpx.AsyncClient(
        headers={"User-Agent": "PortfolioSite/1.0"}, timeout=10.0
    ) as client:
        # Fetch up to 3 pages of events (300 events, ~a few days of history)
        all_events = []
        for page in range(1, 4):
            resp = await client.get(
                f"https://api.github.com/users/{GITHUB_USERNAME}/events",
                params={"per_page": 100, "page": page},
            )
            resp.raise_for_status()
            events = resp.json()
            if not events:
                break
            all_events.extend(events)

    # Aggregate commits and PRs by date
    daily: dict[str, dict[str, int]] = {}
    for ev in all_events:
        # GitHub Events API timestamps are UTC; convert to local before bucketing by day
        created = datetime.fromisoformat(ev["created_at"].replace("Z", "+00:00"))
        date_str = created.astimezone(LOCAL_TZ).date().isoformat()
        if date_str not in daily:
            daily[date_str] = {"commits": 0, "prs": 0}

        if ev["type"] == "PushEvent":
            daily[date_str]["commits"] += 1
        elif ev["type"] == "PullRequestEvent" and ev["payload"].get("action") == "opened":
            daily[date_str]["prs"] += 1

    # Upsert each day into kpi_daily_log
    async with _KPI_POOL.acquire() as conn:
        for date_str, counts in daily.items():
            d = date_type.fromisoformat(date_str)
            await conn.execute(
                """
                INSERT INTO kpi_daily_log (date, github_commits, github_prs)
                VALUES ($1, $2, $3)
                ON CONFLICT (date) DO UPDATE
                  SET github_commits = $2, github_prs = $3
                """,
                d, counts["commits"], counts["prs"],
            )

    log.info("GitHub KPI scraped: %d days updated", len(daily))
    return daily


def verify_kpi_key(x_kpi_api_key: Optional[str] = Header(None)):
    if x_kpi_api_key != os.getenv("KPI_API_KEY"):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/church/test-reminder")
async def church_test_reminder(_=Depends(verify_kpi_key)):
    """Force-send the church check-in text now, bypassing the Sunday/hour gate.

    Use to verify the token + iMessage path end-to-end without waiting for Sunday.
    """
    result = await send_church_reminder(force=True)
    return {"result": result}


@router.post("/weight/test-reminder")
async def weight_test_reminder(_=Depends(verify_kpi_key)):
    """Arm + immediately send a weigh-in link for today, to test the flow end-to-end."""
    today = date_type.today()
    async with _KPI_POOL.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_daily_log (date, weight_due_at)
            VALUES ($1, NOW())
            ON CONFLICT (date) DO UPDATE
              SET weight_due_at = NOW(), weight_reminded_at = NULL
            WHERE kpi_daily_log.weight_lbs IS NULL
            """,
            today,
        )
    result = await send_weight_reminders()
    return {"result": result}


@router.get("")
async def get_kpi(_=Depends(verify_kpi_key)):
    umami_base = os.getenv("UMAMI_BASE_URL", "http://100.79.61.79:3333")
    website_id = os.getenv("UMAMI_WEBSITE_ID")

    visitor_data = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Authenticate with Umami
            auth_res = await client.post(
                f"{umami_base}/api/auth/login",
                json={
                    "username": os.getenv("UMAMI_USERNAME", "admin"),
                    "password": os.getenv("UMAMI_PASSWORD", "umami"),
                },
            )
            token = auth_res.json().get("token", "")

            # Get stats for last 7 days
            now_ms = int(time.time() * 1000)
            week_ago_ms = now_ms - 7 * 24 * 60 * 60 * 1000

            stats_res = await client.get(
                f"{umami_base}/api/websites/{website_id}/stats",
                params={"startAt": week_ago_ms, "endAt": now_ms},
                headers={"Authorization": f"Bearer {token}"},
            )
            visitor_data = stats_res.json()
    except Exception as e:
        log.warning("Umami unavailable: %s", e)

    def _val(d, key):
        v = d.get(key, 0)
        return v.get("value", 0) if isinstance(v, dict) else (v or 0)

    uniques = _val(visitor_data, "uniques")
    pageviews = _val(visitor_data, "pageviews")
    bounces = _val(visitor_data, "bounces")
    total_time = _val(visitor_data, "totaltime")

    # Instagram pickup counts — per-day series
    ig_days = []
    try:
        async with _KPI_POOL.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT date, COALESCE(instagram_pickups, 0) AS count
                FROM kpi_daily_log
                WHERE instagram_pickups > 0
                ORDER BY date ASC
                """
            )
            ig_days = [{"date": str(r["date"]), "count": r["count"]} for r in rows]
    except Exception as e:
        log.warning("Instagram pickups unavailable: %s", e)

    # GitHub commits & PRs — per-day series
    gh_days = []
    try:
        async with _KPI_POOL.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT date,
                       COALESCE(github_commits, 0) AS commits,
                       COALESCE(github_prs, 0) AS prs
                FROM kpi_daily_log
                WHERE github_commits > 0 OR github_prs > 0
                ORDER BY date ASC
                """
            )
            gh_days = [
                {"date": str(r["date"]), "commits": r["commits"], "prs": r["prs"]}
                for r in rows
            ]
    except Exception as e:
        log.warning("GitHub KPI unavailable: %s", e)

    # Weight & BMI — per-day series
    weight_days = []
    try:
        async with _KPI_POOL.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT date, weight_lbs, bmi
                FROM kpi_daily_log
                WHERE weight_lbs IS NOT NULL
                ORDER BY date ASC
                """
            )
            weight_days = [
                {
                    "date": str(r["date"]),
                    "weight_lbs": float(r["weight_lbs"]),
                    "bmi": float(r["bmi"]) if r["bmi"] is not None else None,
                }
                for r in rows
            ]
    except Exception as e:
        log.warning("Weight KPI unavailable: %s", e)

    return {
        "project": "personal_site",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": {
            "weekly_unique_visitors": {
                "value": uniques,
                "label": "Weekly Unique Visitors",
                "unit": "visitors",
            },
            "weekly_pageviews": {
                "value": pageviews,
                "label": "Weekly Pageviews",
                "unit": "pageviews",
            },
            "bounce_rate": {
                "value": round(bounces / uniques * 100, 1) if uniques > 0 else 0.0,
                "label": "Bounce Rate",
                "unit": "%",
            },
            "avg_time_on_site_seconds": {
                "value": round(total_time / uniques) if uniques > 0 else 0,
                "label": "Avg Time on Site",
                "unit": "seconds",
            },
            "pages_per_session": {
                "value": round(pageviews / uniques, 2) if uniques > 0 else 0.0,
                "label": "Pages per Session",
                "unit": "pages",
            },
            "instagram_pickups": {
                "value": ig_days,
                "label": "Instagram Pickups per Day",
                "unit": "opens",
            },
            "github_activity": {
                "value": gh_days,
                "label": "GitHub Commits & PRs per Day",
                "unit": "count",
            },
            "weight": {
                "value": weight_days,
                "label": "Weight & BMI per Day",
                "unit": "lbs",
            },
        },
    }
