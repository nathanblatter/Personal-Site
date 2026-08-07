import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import AsyncSessionLocal
from app.cache import cache
from app import models
from app.auth import require_auth

router = APIRouter(prefix="/claude", tags=["claude"])

# Comma-separated list of data dirs (falls back to single CLAUDE_DATA_DIR for compat)
_dirs_env = os.getenv("CLAUDE_DATA_DIRS") or os.getenv("CLAUDE_DATA_DIR", "/claude_data")
CLAUDE_DATA_DIRS = [Path(p.strip()) for p in _dirs_env.split(",") if p.strip()]

CACHE_TTL = 3600  # 1 hour
LOCAL_TZ = ZoneInfo(os.getenv("TZ", "America/Denver"))

PRICING = {
    "claude-fable": {"input": 30.00, "output": 150.00, "cache_create": 37.50, "cache_read": 3.00},
    "claude-opus":   {"input": 15.00, "output": 75.00, "cache_create": 18.75, "cache_read": 1.50},
    "claude-sonnet": {"input":  3.00, "output": 15.00, "cache_create":  3.75, "cache_read": 0.30},
    "claude-haiku":  {"input":  0.80, "output":  4.00, "cache_create":  1.00, "cache_read": 0.08},
}


def _get_pricing(model: str) -> dict | None:
    for prefix, rates in PRICING.items():
        if model.startswith(prefix):
            return rates
    return None


def _project_name(jsonl_path: Path) -> str:
    dir_name = jsonl_path.parent.name
    parts = dir_name.split("-")
    skip = {"", "Users", "home", "Desktop", "Documents", "Projects", "code", "dev", "workspace"}
    meaningful = [p for p in parts if p and p not in skip]
    if not meaningful:
        return dir_name
    return "-".join(meaningful[-2:]) if len(meaningful) >= 2 else meaningful[-1]


def _week_key(day_str: str) -> str:
    """ISO year-week bucket for a YYYY-MM-DD date string, e.g. '2026-W31'."""
    iso = datetime.fromisoformat(day_str).isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _scan_jsonl() -> dict:
    """Scan JSONL files and return raw aggregations (no DB, no cache)."""
    days: dict[str, dict] = {}
    models_agg: dict[str, dict] = {}
    projects: dict[str, dict] = {}

    for data_dir in CLAUDE_DATA_DIRS:
        if not data_dir.exists():
            continue
        for jsonl_file in data_dir.rglob("*.jsonl"):
            if "memory" in jsonl_file.parts:
                continue

            project = _project_name(jsonl_file)

            try:
                with open(jsonl_file, encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            msg = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if msg.get("type") != "assistant":
                            continue

                        message = msg.get("message", {})
                        usage = message.get("usage")
                        if not usage or not usage.get("output_tokens"):
                            continue

                        model = message.get("model", "unknown")
                        session_id = msg.get("sessionId", "")
                        ts = msg.get("timestamp", "")

                        try:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            day_str = dt.astimezone(LOCAL_TZ).date().isoformat()
                        except (ValueError, AttributeError):
                            continue

                        input_t = usage.get("input_tokens", 0) or 0
                        output_t = usage.get("output_tokens", 0) or 0
                        cache_create_t = usage.get("cache_creation_input_tokens", 0) or 0
                        cache_read_t = usage.get("cache_read_input_tokens", 0) or 0
                        total_tokens = input_t + output_t + cache_create_t + cache_read_t

                        rates = _get_pricing(model)
                        cost_cents = 0.0
                        if rates:
                            cost_cents = (
                                input_t * rates["input"] / 1_000_000
                                + output_t * rates["output"] / 1_000_000
                                + cache_create_t * rates["cache_create"] / 1_000_000
                                + cache_read_t * rates["cache_read"] / 1_000_000
                            ) * 100

                        if day_str not in days:
                            days[day_str] = {"tokens": 0, "cost_cents": 0.0, "sessions": set()}
                        days[day_str]["tokens"] += total_tokens
                        days[day_str]["cost_cents"] += cost_cents
                        if session_id:
                            days[day_str]["sessions"].add(session_id)

                        if model not in models_agg:
                            models_agg[model] = {"tokens": 0, "cost_cents": 0.0, "sessions": set(), "last_active": None, "days": {}}
                        models_agg[model]["tokens"] += total_tokens
                        models_agg[model]["cost_cents"] += cost_cents
                        if session_id:
                            models_agg[model]["sessions"].add(session_id)
                        if models_agg[model]["last_active"] is None or day_str > models_agg[model]["last_active"]:
                            models_agg[model]["last_active"] = day_str
                        m_day = models_agg[model]["days"].setdefault(day_str, {"tokens": 0, "cost_cents": 0.0, "sessions": set()})
                        m_day["tokens"] += total_tokens
                        m_day["cost_cents"] += cost_cents
                        if session_id:
                            m_day["sessions"].add(session_id)

                        if project not in projects:
                            projects[project] = {"tokens": 0, "cost_cents": 0.0, "sessions": set(), "days": {}}
                        projects[project]["tokens"] += total_tokens
                        projects[project]["cost_cents"] += cost_cents
                        if session_id:
                            projects[project]["sessions"].add(session_id)
                        p_days = projects[project]["days"]
                        if day_str not in p_days:
                            p_days[day_str] = {"tokens": 0, "cost_cents": 0.0, "sessions": set()}
                        p_days[day_str]["tokens"] += total_tokens
                        p_days[day_str]["cost_cents"] += cost_cents
                        if session_id:
                            p_days[day_str]["sessions"].add(session_id)

            except (OSError, PermissionError):
                continue

    return {"days": days, "models": models_agg, "projects": projects}


def _sess_count(v: dict) -> int:
    """Session count for an aggregate whose live sessions are a set, plus any
    integer count merged in from DB-restored history (extra_sessions)."""
    s = v["sessions"]
    return (len(s) if isinstance(s, set) else s) + v.get("extra_sessions", 0)


def _build_result(days: dict, models_agg: dict, projects: dict) -> dict:
    """Convert raw aggregation dicts into the final API response shape."""
    sorted_day_keys = sorted(days.keys())
    days_list = [
        {
            "date": d,
            "tokens": days[d]["tokens"],
            "cost_cents": round(days[d]["cost_cents"]),
            "sessions": len(days[d]["sessions"]) if isinstance(days[d]["sessions"], set) else days[d]["sessions"],
        }
        for d in sorted_day_keys
    ]

    local_today = datetime.now(LOCAL_TZ).date()
    all_active = {d for d, v in days.items() if v["tokens"] > 0}

    streak = 0
    if days:
        current = local_today
        while current.isoformat() in all_active:
            streak += 1
            current = current - timedelta(days=1)

    # Longest historical run of consecutive active days (may differ from the
    # current running streak above).
    longest_streak = 0
    if all_active:
        run = 0
        prev_date = None
        for d in sorted(all_active):
            cur_date = datetime.fromisoformat(d).date()
            if prev_date is not None and cur_date == prev_date + timedelta(days=1):
                run += 1
            else:
                run = 1
            longest_streak = max(longest_streak, run)
            prev_date = cur_date

    total_tokens = sum(v["tokens"] for v in days.values())
    total_cost_cents = round(sum(v["cost_cents"] for v in days.values()))
    total_sessions = sum(
        len(v["sessions"]) if isinstance(v["sessions"], set) else v["sessions"]
        for v in days.values()
    )
    active_days = sum(1 for v in days.values() if v["tokens"] > 0)
    first_active_day = min(all_active) if all_active else None
    last_active_day = max(all_active) if all_active else None

    # Last-30-days vs all-time split (based on the days table, which already
    # includes DB-restored historical rows merged in by the caller).
    cutoff_30 = (local_today - timedelta(days=29)).isoformat()
    last_30_tokens = 0
    last_30_cost_cents = 0.0
    last_30_sessions = 0
    last_30_active_days = 0
    for d, v in days.items():
        if d < cutoff_30:
            continue
        last_30_tokens += v["tokens"]
        last_30_cost_cents += v["cost_cents"]
        last_30_sessions += len(v["sessions"]) if isinstance(v["sessions"], set) else v["sessions"]
        if v["tokens"] > 0:
            last_30_active_days += 1

    models_list = sorted(
        [
            {
                "name": k,
                "tokens": v["tokens"],
                "cost_cents": round(v["cost_cents"]),
                "sessions": _sess_count(v),
                "last_active": v["last_active"],
            }
            for k, v in models_agg.items()
        ],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )

    # Weekly buckets covering the trailing ~12 weeks, used to build a per-
    # project sparkline without shipping a full daily series for every project.
    cutoff_84 = local_today - timedelta(days=83)
    week_order: list[str] = []
    seen_weeks: set[str] = set()
    d = cutoff_84
    while d <= local_today:
        wk = _week_key(d.isoformat())
        if wk not in seen_weeks:
            seen_weeks.add(wk)
            week_order.append(wk)
        d += timedelta(days=1)
    cutoff_84_str = cutoff_84.isoformat()

    projects_full = []
    for k, v in projects.items():
        p_days = v["days"]
        active_day_count = sum(1 for pd in p_days.values() if pd["tokens"] > 0)
        last_active = max(p_days.keys()) if p_days else None

        p_last_30_tokens = 0
        p_last_30_cost_cents = 0.0
        weekly: dict[str, dict] = {}
        for day_str, day_v in p_days.items():
            if day_str >= cutoff_30:
                p_last_30_tokens += day_v["tokens"]
                p_last_30_cost_cents += day_v["cost_cents"]
            if day_str >= cutoff_84_str:
                wk = _week_key(day_str)
                if wk not in weekly:
                    weekly[wk] = {"tokens": 0, "cost_cents": 0.0}
                weekly[wk]["tokens"] += day_v["tokens"]
                weekly[wk]["cost_cents"] += day_v["cost_cents"]

        sparkline = [
            {
                "week": wk,
                "tokens": weekly.get(wk, {}).get("tokens", 0),
                "cost_cents": round(weekly.get(wk, {}).get("cost_cents", 0)),
            }
            for wk in week_order
        ]

        projects_full.append({
            "name": k,
            "tokens": v["tokens"],
            "cost_cents": round(v["cost_cents"]),
            "sessions": _sess_count(v),
            "active_days": active_day_count,
            "last_active": last_active,
            "last_30d_tokens": p_last_30_tokens,
            "last_30d_cost_cents": round(p_last_30_cost_cents),
            "sparkline": sparkline,
        })

    projects_list = sorted(projects_full, key=lambda x: x["cost_cents"], reverse=True)[:6]
    most_active_project = projects_list[0]["name"] if projects_list else None

    return {
        "days": days_list,
        "models": models_list,
        "projects": projects_list,
        "summary": {
            "total_tokens": total_tokens,
            "total_cost_cents": total_cost_cents,
            "total_sessions": total_sessions,
            "active_days": active_days,
            "streak": streak,
            "longest_streak": longest_streak,
            "first_active_day": first_active_day,
            "last_active_day": last_active_day,
            "most_active_project": most_active_project,
            "last_30_days": {
                "tokens": last_30_tokens,
                "cost_cents": round(last_30_cost_cents),
                "sessions": last_30_sessions,
                "active_days": last_30_active_days,
            },
        },
    }


async def _do_snapshot() -> int:
    """Read JSONL data and upsert all days into DB. Returns number of days upserted."""
    scan = _scan_jsonl()
    days = scan["days"]
    if not days:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "date": d,
            "tokens": v["tokens"],
            "cost_cents": round(v["cost_cents"]),
            "sessions": len(v["sessions"]) if isinstance(v["sessions"], set) else v["sessions"],
            "snapshotted_at": now_iso,
        }
        for d, v in days.items()
    ]

    # Per-project / per-model daily breakdowns (personal-site-57): summary
    # totals already survived JSONL pruning via ClaudeUsageDay; these rows let
    # sparklines/sessions/actives survive it too.
    breakdown_rows = []
    for kind, aggs in (("model", scan["models"]), ("project", scan["projects"])):
        for name, agg in aggs.items():
            for day_str, dv in agg.get("days", {}).items():
                breakdown_rows.append({
                    "date": day_str,
                    "kind": kind,
                    "name": name,
                    "tokens": dv["tokens"],
                    "cost_cents": round(dv["cost_cents"]),
                    "sessions": len(dv["sessions"]) if isinstance(dv["sessions"], set) else dv["sessions"],
                    "snapshotted_at": now_iso,
                })

    async with AsyncSessionLocal() as session:
        stmt = pg_insert(models.ClaudeUsageDay).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["date"],
            set_={
                "tokens": stmt.excluded.tokens,
                "cost_cents": stmt.excluded.cost_cents,
                "sessions": stmt.excluded.sessions,
                "snapshotted_at": stmt.excluded.snapshotted_at,
            },
        )
        await session.execute(stmt)
        if breakdown_rows:
            bstmt = pg_insert(models.ClaudeUsageBreakdownDay).values(breakdown_rows)
            bstmt = bstmt.on_conflict_do_update(
                index_elements=["date", "kind", "name"],
                set_={
                    "tokens": bstmt.excluded.tokens,
                    "cost_cents": bstmt.excluded.cost_cents,
                    "sessions": bstmt.excluded.sessions,
                    "snapshotted_at": bstmt.excluded.snapshotted_at,
                },
            )
            await session.execute(bstmt)
        await session.commit()

    # Bust cache so next GET reflects merged data
    await cache.delete("claude:usage")
    return len(rows)


@router.get("/usage")
async def claude_usage():
    cached = await cache.get("claude:usage")
    if cached is not None:
        return cached

    # Scan live JSONL files
    scan = _scan_jsonl()
    jsonl_days = scan["days"]           # date -> {tokens, cost_cents, sessions: set}
    models_agg = scan["models"]
    projects = scan["projects"]

    # Pull DB-persisted days that aren't covered by current JSONL
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.ClaudeUsageDay))
        db_rows = result.scalars().all()

        restored_dates = [row.date for row in db_rows if row.date not in jsonl_days]
        breakdown_rows = []
        if restored_dates:
            bres = await session.execute(
                select(models.ClaudeUsageBreakdownDay).where(
                    models.ClaudeUsageBreakdownDay.date.in_(restored_dates)
                )
            )
            breakdown_rows = bres.scalars().all()

    merged_days = dict(jsonl_days)  # start with live data
    for row in db_rows:
        if row.date not in merged_days:
            # Historical day no longer in JSONL — restore from DB
            merged_days[row.date] = {
                "tokens": row.tokens,
                "cost_cents": row.cost_cents,
                "sessions": row.sessions,  # int, not set
            }

    # Merge restored per-model/per-project history so breakdowns (sparklines,
    # sessions, active days, last-30d) match the restored summary totals.
    for r in breakdown_rows:
        if r.kind == "model":
            m = models_agg.setdefault(
                r.name, {"tokens": 0, "cost_cents": 0.0, "sessions": set(), "last_active": None, "days": {}}
            )
            m["tokens"] += r.tokens
            m["cost_cents"] += r.cost_cents
            m["extra_sessions"] = m.get("extra_sessions", 0) + r.sessions
            if m["last_active"] is None or r.date > m["last_active"]:
                m["last_active"] = r.date
        else:
            p = projects.setdefault(
                r.name, {"tokens": 0, "cost_cents": 0.0, "sessions": set(), "days": {}}
            )
            p["tokens"] += r.tokens
            p["cost_cents"] += r.cost_cents
            p["extra_sessions"] = p.get("extra_sessions", 0) + r.sessions
            pd = p["days"].setdefault(r.date, {"tokens": 0, "cost_cents": 0.0, "sessions": set()})
            pd["tokens"] += r.tokens
            pd["cost_cents"] += r.cost_cents

    result_data = _build_result(merged_days, models_agg, projects)
    await cache.set("claude:usage", result_data, ttl=CACHE_TTL)
    return result_data


@router.post("/snapshot", dependencies=[Depends(require_auth)])
async def claude_snapshot():
    """Persist current JSONL usage data to DB so history survives JSONL pruning."""
    count = await _do_snapshot()
    return {"ok": True, "days_upserted": count}
