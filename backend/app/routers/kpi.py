"""KPI router — exposes site analytics metrics for external dashboards."""

import json
import logging
import os
import time
import httpx
import asyncpg
from datetime import date as date_type, datetime, time as time_type, timezone
from typing import Optional
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

log = logging.getLogger("kpi")

router = APIRouter(prefix="/kpi", tags=["kpi"])

# ---------------------------------------------------------------------------
# Health Ingest — separate router registered at /api (not /api/v1)
# ---------------------------------------------------------------------------

_KPI_POOL: asyncpg.Pool | None = None

_ALLOWED_FIELDS = frozenset({
    "resting_hr", "hrv_morning", "sleep_hrs", "sleep_bedtime",
    "steps", "active_cal", "workout_type", "workout_duration_min",
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
    sleep_hrs: Optional[float] = None
    sleep_bedtime: Optional[time_type] = None
    steps: Optional[int] = None
    active_cal: Optional[int] = None
    workout_type: Optional[str] = None
    workout_duration_min: Optional[int] = None
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
        },
    }
