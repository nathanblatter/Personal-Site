"""KPI router — exposes site analytics metrics for external dashboards."""

import os
import time
import httpx
import asyncpg
from datetime import date as date_type, datetime, time as time_type, timezone
from typing import Optional
from urllib.parse import urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

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
        print(f"Umami unavailable: {e}")

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
        print(f"Instagram pickups unavailable: {e}")

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
        },
    }
