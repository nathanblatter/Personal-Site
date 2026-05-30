import json
import os
import time
from datetime import date, datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import AsyncSessionLocal
from app import models
from app.auth import require_auth

router = APIRouter(prefix="/claude", tags=["claude"])

# Comma-separated list of data dirs (falls back to single CLAUDE_DATA_DIR for compat)
_dirs_env = os.getenv("CLAUDE_DATA_DIRS") or os.getenv("CLAUDE_DATA_DIR", "/claude_data")
CLAUDE_DATA_DIRS = [Path(p.strip()) for p in _dirs_env.split(",") if p.strip()]

CACHE_TTL = 600  # 10 minutes

_cache: dict = {}

PRICING = {
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
                            day_str = dt.astimezone(timezone.utc).date().isoformat()
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
                            models_agg[model] = {"tokens": 0, "cost_cents": 0.0}
                        models_agg[model]["tokens"] += total_tokens
                        models_agg[model]["cost_cents"] += cost_cents

                        if project not in projects:
                            projects[project] = {"tokens": 0, "cost_cents": 0.0}
                        projects[project]["tokens"] += total_tokens
                        projects[project]["cost_cents"] += cost_cents

            except (OSError, PermissionError):
                continue

    return {"days": days, "models": models_agg, "projects": projects}


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

    today = date.today().isoformat()
    streak = 0
    if days:
        from datetime import timedelta
        all_active = {d for d, v in days.items() if v["tokens"] > 0}
        current = date.today()
        while current.isoformat() in all_active:
            streak += 1
            current = current - timedelta(days=1)

    total_tokens = sum(v["tokens"] for v in days.values())
    total_cost_cents = round(sum(v["cost_cents"] for v in days.values()))
    total_sessions = sum(
        len(v["sessions"]) if isinstance(v["sessions"], set) else v["sessions"]
        for v in days.values()
    )
    active_days = sum(1 for v in days.values() if v["tokens"] > 0)

    models_list = sorted(
        [{"name": k, "tokens": v["tokens"], "cost_cents": round(v["cost_cents"])} for k, v in models_agg.items()],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )

    projects_list = sorted(
        [{"name": k, "tokens": v["tokens"], "cost_cents": round(v["cost_cents"])} for k, v in projects.items()],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )[:6]

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
        await session.commit()

    # Bust cache so next GET reflects merged data
    _cache.clear()
    return len(rows)


@router.get("/usage")
async def claude_usage():
    now = time.time()
    cache_key = "claude_usage"
    if cache_key in _cache and now - _cache[cache_key]["ts"] < CACHE_TTL:
        return _cache[cache_key]["data"]

    # Scan live JSONL files
    scan = _scan_jsonl()
    jsonl_days = scan["days"]           # date -> {tokens, cost_cents, sessions: set}
    models_agg = scan["models"]
    projects = scan["projects"]

    # Pull DB-persisted days that aren't covered by current JSONL
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.ClaudeUsageDay))
        db_rows = result.scalars().all()

    merged_days = dict(jsonl_days)  # start with live data
    for row in db_rows:
        if row.date not in merged_days:
            # Historical day no longer in JSONL — restore from DB
            merged_days[row.date] = {
                "tokens": row.tokens,
                "cost_cents": row.cost_cents,
                "sessions": row.sessions,  # int, not set
            }

    result_data = _build_result(merged_days, models_agg, projects)
    _cache[cache_key] = {"data": result_data, "ts": now}
    return result_data


@router.post("/snapshot", dependencies=[Depends(require_auth)])
async def claude_snapshot():
    """Persist current JSONL usage data to DB so history survives JSONL pruning."""
    count = await _do_snapshot()
    return {"ok": True, "days_upserted": count}
