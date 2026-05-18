import asyncio
import os
import re
import time

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/github", tags=["github"])

GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "nathanzbl")
GITHUB_ORG = os.getenv("GITHUB_ORG", "nathanblatter")
CACHE_TTL = 3600  # 1 hour

_cache: dict = {}
_client = httpx.AsyncClient(
    headers={"User-Agent": "PortfolioSite/1.0"},
    timeout=10.0,
)


async def _fetch_cached(key: str, url: str, ttl: int = CACHE_TTL) -> str:
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < ttl:
        return _cache[key]["data"]

    resp = await _client.get(url)
    resp.raise_for_status()
    data = resp.text

    _cache[key] = {"data": data, "ts": now}
    return data


async def warmup():
    """Pre-warm all GitHub cache entries at startup."""
    try:
        await asyncio.gather(
            _fetch_cached("profile", f"https://api.github.com/users/{GITHUB_USERNAME}"),
            _fetch_cached("repos", f"https://api.github.com/orgs/{GITHUB_ORG}/repos?sort=pushed&per_page=100"),
            _fetch_cached("contributions", f"https://github.com/users/{GITHUB_USERNAME}/contributions"),
            *[
                _fetch_cached(
                    f"events_p{page}",
                    f"https://api.github.com/users/{GITHUB_USERNAME}/events?per_page=100&page={page}",
                )
                for page in range(1, 4)
            ],
        )
    except Exception:
        pass  # warmup failure is non-fatal; cache will fill on first request


@router.get("/profile")
async def github_profile():
    raw = await _fetch_cached("profile", f"https://api.github.com/users/{GITHUB_USERNAME}")
    import json
    d = json.loads(raw)
    return {
        "username": d["login"],
        "name": d.get("name"),
        "avatar_url": d["avatar_url"],
        "html_url": d["html_url"],
        "public_repos": d["public_repos"],
        "followers": d["followers"],
        "bio": d.get("bio"),
    }


@router.get("/repos")
async def github_repos():
    import json
    raw = await _fetch_cached(
        "repos",
        f"https://api.github.com/orgs/{GITHUB_ORG}/repos?sort=pushed&per_page=100",
    )
    repos = json.loads(raw)
    return [
        {
            "name": r["name"],
            "description": r.get("description"),
            "language": r.get("language"),
            "stars": r["stargazers_count"],
            "forks": r["forks_count"],
            "html_url": r["html_url"],
            "homepage": r.get("homepage"),
            "updated_at": r["pushed_at"],
            "fork": r["fork"],
        }
        for r in repos
        if not r["fork"]
    ]


@router.get("/contributions")
async def github_contributions():
    import json

    html = await _fetch_cached(
        "contributions",
        f"https://github.com/users/{GITHUB_USERNAME}/contributions",
    )

    raw_days = re.findall(r'data-date="([^"]+)"[^>]*data-level="([^"]+)"', html)

    total_match = re.search(r"(\d[\d,]*)\s+contributions?\s+in\s+the\s+last\s+year", html)
    total = int(total_match.group(1).replace(",", "")) if total_match else 0

    # GitHub HTML is row-major (all Sundays, then all Mondays, etc.)
    # Transpose to column-major (week-by-week: Sun0,Mon0,...,Sat0,Sun1,...)
    # so the frontend can chunk by 7 for each week column.
    num_weeks = len(raw_days) // 7
    remainder = len(raw_days) % 7
    rows: list[list[tuple[str, str]]] = []
    offset = 0
    for r in range(7):
        row_len = num_weeks + (1 if r < remainder else 0)
        rows.append(raw_days[offset : offset + row_len])
        offset += row_len

    days: list[tuple[str, str]] = []
    max_cols = max(len(row) for row in rows)
    for col in range(max_cols):
        for row in rows:
            if col < len(row):
                days.append(row[col])

    # Current streak
    streak = 0
    for date, level in reversed(days):
        if int(level) > 0:
            streak += 1
        elif streak > 0:
            break

    # Fetch all 3 event pages in parallel
    pages_raw = await asyncio.gather(
        *[
            _fetch_cached(
                f"events_p{page}",
                f"https://api.github.com/users/{GITHUB_USERNAME}/events?per_page=100&page={page}",
            )
            for page in range(1, 4)
        ],
        return_exceptions=True,
    )

    activity: dict[str, list[dict]] = {}
    for raw_events in pages_raw:
        if isinstance(raw_events, Exception):
            continue
        events = json.loads(raw_events)
        if not events:
            break
        for ev in events:
            if ev["type"] != "PushEvent":
                continue
            date = ev["created_at"][:10]
            repo_name = ev["repo"]["name"].split("/")[-1]
            repo_url = f"https://github.com/{ev['repo']['name']}"
            if date not in activity:
                activity[date] = []
            if not any(r["name"] == repo_name for r in activity[date]):
                activity[date].append({"name": repo_name, "url": repo_url})

    return {
        "total": total,
        "streak": streak,
        "days": [{"date": d, "level": int(l)} for d, l in days],
        "activity": activity,
    }
