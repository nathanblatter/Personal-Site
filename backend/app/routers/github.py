import asyncio
import json
import os
import re

import httpx
from fastapi import APIRouter

from app.cache import cache
from app.imessage_service import send_alert

router = APIRouter(prefix="/github", tags=["github"])

GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "nathanzbl")
GITHUB_ORG = os.getenv("GITHUB_ORG", "nathanblatter")  # fallback-only (single-org REST)
# A PAT unlocks the GraphQL contributionsCollection API (all commits/PRs across
# every org/repo the token can see). Without it we degrade to the old
# unauthenticated HTML-scrape + public-events approach.
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "") or os.getenv("GH_TOKEN", "")
CACHE_TTL = 3600  # 1 hour

_LEVEL_MAP = {
    "NONE": 0,
    "FIRST_QUARTILE": 1,
    "SECOND_QUARTILE": 2,
    "THIRD_QUARTILE": 3,
    "FOURTH_QUARTILE": 4,
}

_headers = {"User-Agent": "PortfolioSite/1.0", "Accept": "application/vnd.github+json"}
if GITHUB_TOKEN:
    _headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

_client = httpx.AsyncClient(headers=_headers, timeout=15.0)


# ── low-level fetch helpers ──────────────────────────────────────────────


async def _fetch_cached(key: str, url: str, ttl: int = CACHE_TTL) -> str:
    cached = await cache.get(f"github:{key}")
    if cached is not None:
        return cached

    resp = await _client.get(url)
    resp.raise_for_status()
    data = resp.text

    await cache.set(f"github:{key}", data, ttl=ttl)
    return data


async def _graphql(query: str, variables: dict | None = None) -> dict:
    resp = await _client.post(
        "https://api.github.com/graphql",
        json={"query": query, "variables": variables or {}},
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("errors"):
        raise RuntimeError(f"GitHub GraphQL error: {payload['errors']}")
    return payload["data"]


# ── warmup ───────────────────────────────────────────────────────────────


async def warmup():
    """Pre-warm GitHub cache entries at startup (best-effort)."""
    try:
        await asyncio.gather(
            github_profile(),
            github_repos(),
            github_contributions(),
            return_exceptions=True,
        )
    except Exception:
        pass  # warmup failure is non-fatal; cache will fill on first request


# ── profile ──────────────────────────────────────────────────────────────


@router.get("/profile")
async def github_profile():
    raw = await _fetch_cached("profile", f"https://api.github.com/users/{GITHUB_USERNAME}")
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


# ── repos ────────────────────────────────────────────────────────────────

_REPOS_GQL = """
query {
  viewer {
    repositories(
      first: 100
      isFork: false
      privacy: PUBLIC
      ownerAffiliations: [OWNER, ORGANIZATION_MEMBER]
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        name
        description
        primaryLanguage { name }
        stargazerCount
        forkCount
        url
        homepageUrl
        pushedAt
        isFork
        owner { login }
      }
    }
  }
}
"""


async def _repos_graphql() -> list[dict]:
    data = await _graphql(_REPOS_GQL)
    nodes = data["viewer"]["repositories"]["nodes"]
    return [
        {
            "name": r["name"],
            "description": r.get("description"),
            "language": (r.get("primaryLanguage") or {}).get("name"),
            "stars": r["stargazerCount"],
            "forks": r["forkCount"],
            "html_url": r["url"],
            "homepage": r.get("homepageUrl") or None,
            "updated_at": r["pushedAt"],
            "fork": r["isFork"],
            "owner": r["owner"]["login"],
        }
        for r in nodes
        if not r["isFork"]
    ]


async def _repos_fallback() -> list[dict]:
    """Unauthenticated: single-org public repos (legacy behaviour)."""
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
            "owner": r["owner"]["login"],
        }
        for r in repos
        if not r["fork"]
    ]


@router.get("/repos")
async def github_repos():
    cached = await cache.get("github:repos_v2")
    if cached is not None:
        return cached

    try:
        repos = await _repos_graphql() if GITHUB_TOKEN else await _repos_fallback()
    except Exception:
        repos = await _repos_fallback()

    await cache.set("github:repos_v2", repos, ttl=CACHE_TTL)
    return repos


# ── contributions ────────────────────────────────────────────────────────

_CONTRIB_GQL = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository { name url isPrivate owner { login } }
        contributions(first: 100) {
          nodes { occurredAt commitCount }
        }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { name url isPrivate owner { login } }
        contributions(first: 100) {
          nodes { occurredAt }
        }
      }
    }
  }
}
"""


async def _contributions_graphql() -> dict:
    data = await _graphql(_CONTRIB_GQL, {"login": GITHUB_USERNAME})
    c = data["user"]["contributionsCollection"]

    # Flatten the calendar week-by-week (each week = 7 chronological days) so
    # the frontend can chunk `days` back into 7-day columns.
    days: list[dict] = []
    for week in c["contributionCalendar"]["weeks"]:
        for d in week["contributionDays"]:
            days.append({"date": d["date"], "level": _LEVEL_MAP.get(d["contributionLevel"], 0)})

    # Current streak (walk backwards from most recent day).
    streak = 0
    for d in reversed(days):
        if d["level"] > 0:
            streak += 1
        elif streak > 0:
            break

    # Per-day repo activity, aggregated across ALL orgs/repos the token sees.
    # Private repos count toward totals/owners but their names/URLs are never
    # exposed in the public per-day activity payload.
    activity: dict[str, list[dict]] = {}

    def _add_activity(date: str, repo: dict):
        if repo["isPrivate"]:
            return
        bucket = activity.setdefault(date, [])
        if not any(r["name"] == repo["name"] for r in bucket):
            bucket.append({"name": repo["name"], "url": repo["url"]})

    owners: dict[str, dict] = {}

    for repo_group in c["commitContributionsByRepository"]:
        repo = repo_group["repository"]
        owner = repo["owner"]["login"]
        o = owners.setdefault(owner, {"owner": owner, "commits": 0, "prs": 0})
        for node in repo_group["contributions"]["nodes"]:
            date = node["occurredAt"][:10]
            o["commits"] += node["commitCount"]
            _add_activity(date, repo)

    for repo_group in c["pullRequestContributionsByRepository"]:
        repo = repo_group["repository"]
        owner = repo["owner"]["login"]
        o = owners.setdefault(owner, {"owner": owner, "commits": 0, "prs": 0})
        for node in repo_group["contributions"]["nodes"]:
            date = node["occurredAt"][:10]
            o["prs"] += 1
            _add_activity(date, repo)

    owners_list = sorted(
        owners.values(), key=lambda x: x["commits"] + x["prs"], reverse=True
    )

    return {
        "total": c["contributionCalendar"]["totalContributions"],
        "streak": streak,
        "days": days,
        "activity": activity,
        "stats": {
            "commits": c["totalCommitContributions"],
            "prs": c["totalPullRequestContributions"],
            "issues": c["totalIssueContributions"],
            "reviews": c["totalPullRequestReviewContributions"],
            "private": c["restrictedContributionsCount"],
        },
        "owners": owners_list,
        "source": "graphql",
    }


async def _contributions_fallback() -> dict:
    """Unauthenticated: scrape the public HTML calendar + public events feed.

    Undercounts heavily — misses private contributions and only sees the last
    ~90 days / 300 public events for per-day repo attribution.
    """
    html = await _fetch_cached(
        "contributions",
        f"https://github.com/users/{GITHUB_USERNAME}/contributions",
    )

    raw_days = re.findall(r'data-date="([^"]+)"[^>]*data-level="([^"]+)"', html)

    total_match = re.search(r"(\d[\d,]*)\s+contributions?\s+in\s+the\s+last\s+year", html)
    total = int(total_match.group(1).replace(",", "")) if total_match else 0

    # GitHub HTML is row-major (all Sundays, then all Mondays, ...). Transpose
    # to column-major (week-by-week) so the frontend can chunk by 7.
    num_weeks = len(raw_days) // 7
    remainder = len(raw_days) % 7
    rows: list[list[tuple[str, str]]] = []
    offset = 0
    for r in range(7):
        row_len = num_weeks + (1 if r < remainder else 0)
        rows.append(raw_days[offset : offset + row_len])
        offset += row_len

    days_pairs: list[tuple[str, str]] = []
    max_cols = max((len(row) for row in rows), default=0)
    for col in range(max_cols):
        for row in rows:
            if col < len(row):
                days_pairs.append(row[col])

    days = [{"date": d, "level": int(l)} for d, l in days_pairs]

    streak = 0
    for d in reversed(days):
        if d["level"] > 0:
            streak += 1
        elif streak > 0:
            break

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
            activity.setdefault(date, [])
            if not any(r["name"] == repo_name for r in activity[date]):
                activity[date].append({"name": repo_name, "url": repo_url})

    return {
        "total": total,
        "streak": streak,
        "days": days,
        "activity": activity,
        "stats": {"commits": 0, "prs": 0, "issues": 0, "reviews": 0, "private": 0},
        "owners": [],
        "source": "fallback",
    }


async def _alert_graphql_degraded() -> None:
    """One-shot iMessage when a token-backed request lands on the scrape
    fallback (dead/revoked PAT would otherwise silently degrade the viz).
    Redis flag debounces to one alert per 24h; a successful GraphQL request
    clears the flag so a later re-degradation alerts again."""
    if await cache.get("github:fallback_alerted"):
        return
    await cache.set("github:fallback_alerted", True, ttl=86400)
    await send_alert(
        "nathanblatter.com: GitHub viz fell back off GraphQL — the PAT is "
        "likely dead/expired (contributions now on the legacy scrape path)."
    )


@router.get("/contributions")
async def github_contributions():
    cached = await cache.get("github:contributions_v2")
    if cached is not None:
        return cached

    try:
        result = await _contributions_graphql() if GITHUB_TOKEN else await _contributions_fallback()
    except Exception:
        result = await _contributions_fallback()

    if GITHUB_TOKEN:
        if result.get("source") == "fallback":
            await _alert_graphql_degraded()
        else:
            await cache.delete("github:fallback_alerted")

    await cache.set("github:contributions_v2", result, ttl=CACHE_TTL)
    return result
