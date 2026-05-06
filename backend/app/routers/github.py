import os
import re
import time
from urllib.request import urlopen, Request
from fastapi import APIRouter
import json as _json

router = APIRouter(prefix="/github", tags=["github"])

GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "nathanblatter")
CACHE_TTL = 3600  # 1 hour

_cache: dict = {}


def _fetch_cached(key: str, url: str, headers: dict | None = None, ttl: int = CACHE_TTL):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < ttl:
        return _cache[key]["data"]

    req = Request(url, headers=headers or {"User-Agent": "PortfolioSite/1.0"})
    with urlopen(req, timeout=10) as resp:
        data = resp.read().decode()

    _cache[key] = {"data": data, "ts": now}
    return data


@router.get("/profile")
def github_profile():
    raw = _fetch_cached("profile", f"https://api.github.com/users/{GITHUB_USERNAME}")
    d = _json.loads(raw)
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
def github_repos():
    raw = _fetch_cached(
        "repos",
        f"https://api.github.com/users/{GITHUB_USERNAME}/repos?sort=pushed&per_page=100",
    )
    repos = _json.loads(raw)
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
def github_contributions():
    html = _fetch_cached(
        "contributions",
        f"https://github.com/users/{GITHUB_USERNAME}/contributions",
    )

    days = re.findall(r'data-date="([^"]+)"[^>]*data-level="([^"]+)"', html)

    total_match = re.search(r"(\d[\d,]*)\s+contributions?\s+in\s+the\s+last\s+year", html)
    total = int(total_match.group(1).replace(",", "")) if total_match else 0

    # Current streak
    streak = 0
    for date, level in reversed(days):
        if int(level) > 0:
            streak += 1
        elif streak > 0:
            break

    return {
        "total": total,
        "streak": streak,
        "days": [{"date": d, "level": int(l)} for d, l in days],
    }
