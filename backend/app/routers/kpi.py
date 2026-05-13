"""KPI router — exposes site analytics metrics for external dashboards."""

import os
import time
import httpx
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header

router = APIRouter(prefix="/kpi", tags=["kpi"])


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
        },
    }
