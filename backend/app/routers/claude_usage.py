import json
import os
import time
from datetime import date, datetime, timezone
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/claude", tags=["claude"])

CLAUDE_DATA_DIR = os.getenv("CLAUDE_DATA_DIR", "/claude_data")
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
    """Derive a human-readable project name from the grandparent directory."""
    # Path: .../projects/-Users-nathanblatter-Desktop-Personal-Site/some-session.jsonl
    # grandparent dir: -Users-nathanblatter-Desktop-Personal-Site
    dir_name = jsonl_path.parent.name
    # Take the last dash-separated segment that looks like a project name
    parts = dir_name.split("-")
    # Find the last meaningful segment (usually the project folder name)
    # e.g. "-Users-nathanblatter-Desktop-Personal-Site" -> "Personal-Site"
    # Heuristic: skip segments that are known path parts (Users, home dir, Desktop, etc.)
    skip = {"", "Users", "home", "Desktop", "Documents", "Projects", "code", "dev", "workspace"}
    meaningful = [p for p in parts if p and p not in skip]
    if not meaningful:
        return dir_name
    # Return last 1-2 segments joined by dash
    return "-".join(meaningful[-2:]) if len(meaningful) >= 2 else meaningful[-1]


def _compute_usage() -> dict:
    now = time.time()
    cache_key = "claude_usage"
    if cache_key in _cache and now - _cache[cache_key]["ts"] < CACHE_TTL:
        return _cache[cache_key]["data"]

    data_dir = Path(CLAUDE_DATA_DIR)

    # Aggregations
    days: dict[str, dict] = {}       # date -> {tokens, cost_cents, sessions: set}
    models: dict[str, dict] = {}     # model -> {tokens, cost_cents}
    projects: dict[str, dict] = {}   # project -> {tokens, cost_cents}

    if data_dir.exists():
        for jsonl_file in data_dir.rglob("*.jsonl"):
            # Skip memory subdirs
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

                        # Cost in cents
                        rates = _get_pricing(model)
                        cost_cents = 0.0
                        if rates:
                            cost_cents = (
                                input_t * rates["input"] / 1_000_000
                                + output_t * rates["output"] / 1_000_000
                                + cache_create_t * rates["cache_create"] / 1_000_000
                                + cache_read_t * rates["cache_read"] / 1_000_000
                            ) * 100  # convert dollars to cents

                        # Aggregate by day
                        if day_str not in days:
                            days[day_str] = {"tokens": 0, "cost_cents": 0.0, "sessions": set()}
                        days[day_str]["tokens"] += total_tokens
                        days[day_str]["cost_cents"] += cost_cents
                        if session_id:
                            days[day_str]["sessions"].add(session_id)

                        # Aggregate by model
                        if model not in models:
                            models[model] = {"tokens": 0, "cost_cents": 0.0}
                        models[model]["tokens"] += total_tokens
                        models[model]["cost_cents"] += cost_cents

                        # Aggregate by project
                        if project not in projects:
                            projects[project] = {"tokens": 0, "cost_cents": 0.0}
                        projects[project]["tokens"] += total_tokens
                        projects[project]["cost_cents"] += cost_cents

            except (OSError, PermissionError):
                continue

    # Build sorted days list
    sorted_days = sorted(days.keys())
    days_list = [
        {
            "date": d,
            "tokens": days[d]["tokens"],
            "cost_cents": round(days[d]["cost_cents"]),
            "sessions": len(days[d]["sessions"]),
        }
        for d in sorted_days
    ]

    # Streak: consecutive days from today backward
    today = date.today().isoformat()
    streak = 0
    if days:
        all_active = set(d for d, v in days.items() if v["tokens"] > 0)
        check = today
        from datetime import timedelta
        current = date.today()
        while current.isoformat() in all_active:
            streak += 1
            current = current - timedelta(days=1)

    # Summary
    total_tokens = sum(v["tokens"] for v in days.values())
    total_cost_cents = round(sum(v["cost_cents"] for v in days.values()))
    total_sessions = len(set(
        s for v in days.values() for s in v["sessions"]
    )) if days else 0
    active_days = sum(1 for v in days.values() if v["tokens"] > 0)

    # Models sorted by cost desc
    models_list = sorted(
        [{"name": k, "tokens": v["tokens"], "cost_cents": round(v["cost_cents"])} for k, v in models.items()],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )

    # Top 6 projects by cost
    projects_list = sorted(
        [{"name": k, "tokens": v["tokens"], "cost_cents": round(v["cost_cents"])} for k, v in projects.items()],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )[:6]

    result = {
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

    _cache[cache_key] = {"data": result, "ts": now}
    return result


@router.get("/usage")
def claude_usage():
    return _compute_usage()
