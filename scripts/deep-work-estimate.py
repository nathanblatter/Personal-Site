#!/usr/bin/env python3
"""Estimate today's deep work hours and POST them to the KPI backend.

Hybrid method:
  1. Deterministically cluster Claude Code session activity into focus blocks
     (a gap longer than GAP_SECONDS ends a block).
  2. Gather today's GitHub push activity (commit counts + push times).
  3. Hand both signals to a headless `claude -p` agent, which fuses them into a
     single `deep_work_hrs` figure plus a one-line rationale.
  4. POST the figure to /api/health-ingest for today's local date.

Runs end-of-day on the Mac Mini via launchd. Uses only the Python stdlib so it
works under the system interpreter (/usr/bin/python3) with no venv.

Required env: HEALTH_INGEST_API_KEY
Optional env: SITE_URL, GITHUB_USERNAME, CLAUDE_BIN, CLAUDE_DATA_DIRS, TZ
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def _load_env_file(path):
    """Source KEY=VALUE pairs from a dotenv file into os.environ.

    Existing environment values win (so a plist override beats the file). This
    lets secrets like ANTHROPIC_API_KEY / HEALTH_INGEST_API_KEY live only in
    backend/.env.prod rather than being duplicated into the launchd plist.
    """
    try:
        with open(path, encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                if line.startswith("export "):
                    line = line[len("export "):]
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except OSError:
        pass


# Load secrets before reading any config below. We try several candidate files
# because launchd (TCC) cannot read ~/Desktop: the home-dir mirror is the
# launchd-readable copy, while backend/.env.prod is the source of truth that
# works when run from a shell with Desktop access. First file to set a key wins.
ENV_FILES = [
    p
    for p in (
        os.environ.get("DEEP_WORK_ENV_FILE"),
        os.path.expanduser("~/.config/deep-work.env"),
        "/Users/nathanblatter/Desktop/Personal-Site/backend/.env.prod",
    )
    if p
]
for _env_file in ENV_FILES:
    _load_env_file(_env_file)

LOCAL_TZ = ZoneInfo(os.environ.get("TZ", "America/Denver"))
GAP_SECONDS = 10 * 60  # a pause longer than this ends a focus block
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/opt/homebrew/bin/claude")
GITHUB_USERNAME = os.environ.get("GITHUB_USERNAME", "nathanzbl")
SITE_URL = os.environ.get("SITE_URL", "https://nathanblatter.com").rstrip("/")
HEALTH_INGEST_API_KEY = os.environ.get("HEALTH_INGEST_API_KEY", "")

_HOME = Path.home()
DATA_DIRS = [
    Path(p.strip())
    for p in os.environ.get(
        "CLAUDE_DATA_DIRS",
        f"{_HOME}/.claude/projects,{_HOME}/.claude-laptop/projects",
    ).split(",")
    if p.strip()
]

_SKIP_PARTS = {"", "Users", "home", "Desktop", "Documents", "Projects", "code", "dev", "workspace"}


def _log(msg: str) -> None:
    print(f"{datetime.now(LOCAL_TZ):%Y-%m-%dT%H:%M:%S%z} {msg}", flush=True)


def _project_name(jsonl_path: Path) -> str:
    parts = jsonl_path.parent.name.split("-")
    meaningful = [p for p in parts if p and p not in _SKIP_PARTS]
    if not meaningful:
        return jsonl_path.parent.name
    return "-".join(meaningful[-2:]) if len(meaningful) >= 2 else meaningful[-1]


def collect_events(target_date):
    """Return sorted list of (datetime_local, project) for today's assistant messages."""
    events = []
    for data_dir in DATA_DIRS:
        if not data_dir.exists():
            continue
        for jf in data_dir.rglob("*.jsonl"):
            if "memory" in jf.parts:
                continue
            project = _project_name(jf)
            try:
                with open(jf, encoding="utf-8", errors="ignore") as f:
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
                        usage = msg.get("message", {}).get("usage")
                        if not usage or not usage.get("output_tokens"):
                            continue
                        ts = msg.get("timestamp", "")
                        try:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(LOCAL_TZ)
                        except (ValueError, AttributeError):
                            continue
                        if dt.date() == target_date:
                            events.append((dt, project))
            except (OSError, PermissionError):
                continue
    events.sort(key=lambda e: e[0])
    return events


def cluster(events):
    """Cluster sorted events into focus blocks; a gap > GAP_SECONDS starts a new block."""
    blocks = []
    cur = None
    for dt, project in events:
        if cur is None or (dt - cur["end"]).total_seconds() > GAP_SECONDS:
            cur = {"start": dt, "end": dt, "msgs": 0, "projects": {}}
            blocks.append(cur)
        cur["end"] = dt
        cur["msgs"] += 1
        cur["projects"][project] = cur["projects"].get(project, 0) + 1
    return blocks


def github_today(target_date):
    """Return {'commit_count': int, 'push_times': [HH:MM, ...]} for today (local)."""
    url = f"https://api.github.com/users/{GITHUB_USERNAME}/events?per_page=100"
    req = urllib.request.Request(url, headers={"User-Agent": "deep-work/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
    except Exception as e:  # noqa: BLE001 - best-effort signal
        _log(f"github fetch failed: {e}")
        return {"commit_count": 0, "push_times": []}

    commit_count = 0
    push_times = []
    for ev in data:
        try:
            dt = datetime.fromisoformat(ev["created_at"].replace("Z", "+00:00")).astimezone(LOCAL_TZ)
        except (ValueError, KeyError, AttributeError):
            continue
        if dt.date() != target_date or ev.get("type") != "PushEvent":
            continue
        push_times.append(f"{dt:%H:%M}")
        # Public payloads expose `size`; stripped payloads (private repos) don't,
        # so count the push as 1 — matching the backend's github_commits semantics.
        commit_count += ev.get("payload", {}).get("size") or 1
    return {"commit_count": commit_count, "push_times": sorted(push_times)}


def build_summary(blocks, gh):
    """Build the deterministic, human-readable signal summary for the agent."""
    total_span_min = sum((b["end"] - b["start"]).total_seconds() / 60 for b in blocks)
    total_msgs = sum(b["msgs"] for b in blocks)
    block_lines = []
    for b in blocks:
        span = (b["end"] - b["start"]).total_seconds() / 60
        top = sorted(b["projects"].items(), key=lambda x: -x[1])
        proj = ", ".join(f"{name}" for name, _ in top[:2]) or "unknown"
        block_lines.append(
            f"  - {b['start']:%H:%M}–{b['end']:%H:%M} ({span:.0f} min, {b['msgs']} msgs) [{proj}]"
        )

    lines = [
        "CLAUDE CODE FOCUS BLOCKS (10-min idle gap splits blocks):",
        *(block_lines or ["  (none)"]),
        "",
        f"Claude blocks: {len(blocks)} | summed in-block span: {total_span_min:.0f} min | total assistant msgs: {total_msgs}",
        "",
        "GITHUB ACTIVITY (today, local time):",
        f"  commits pushed: {gh['commit_count']}",
        f"  push times: {', '.join(gh['push_times']) if gh['push_times'] else '(none)'}",
    ]
    return "\n".join(lines), total_span_min


PROMPT_TEMPLATE = """You estimate a person's "deep work hours" for a single day from activity signals.

Deep work = uninterrupted, cognitively demanding, focused effort. Use the Claude
Code focus blocks as the primary anchor (in-block span ≈ active focused time).
Use GitHub pushes as corroborating signal: commits with little or no matching
Claude activity indicate focused coding done without Claude that should still
count. Do not simply sum block spans blindly — short isolated blocks may be
context-switching, not deep work; clustered sustained blocks are stronger signal.
Be realistic; a normal heavy day is 2–6 hours, rarely above 8.

Today's signals:
{summary}

Respond with ONLY a JSON object, no prose, no markdown fences:
{{"deep_work_hrs": <number, one decimal>, "rationale": "<= 160 chars"}}"""


def ask_claude(summary):
    prompt = PROMPT_TEMPLATE.format(summary=summary)
    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=240,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        _log(f"claude invocation failed: {e}")
        return None
    if proc.returncode != 0:
        _log(f"claude exited {proc.returncode}: {proc.stderr.strip()[:300]}")
        return None
    out = proc.stdout.strip()
    start, end = out.find("{"), out.rfind("}")
    if start == -1 or end == -1:
        _log(f"no JSON in claude output: {out[:300]}")
        return None
    try:
        parsed = json.loads(out[start : end + 1])
        hrs = round(float(parsed["deep_work_hrs"]), 1)
        return {"deep_work_hrs": hrs, "rationale": str(parsed.get("rationale", ""))}
    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
        _log(f"could not parse claude output ({e}): {out[:300]}")
        return None


def post_deep_work(target_date, hrs):
    payload = json.dumps({"date": target_date.isoformat(), "deep_work_hrs": hrs}).encode()
    req = urllib.request.Request(
        f"{SITE_URL}/api/health-ingest",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": HEALTH_INGEST_API_KEY,
            # Cloudflare (error 1010) bans the default Python-urllib UA as a bot.
            "User-Agent": "deep-work/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            _log(f"posted deep_work_hrs={hrs} -> HTTP {r.status}")
            return True
    except urllib.error.HTTPError as e:
        _log(f"POST failed HTTP {e.code}: {e.read().decode(errors='ignore')[:300]}")
    except Exception as e:  # noqa: BLE001
        _log(f"POST failed: {e}")
    return False


def main():
    if not HEALTH_INGEST_API_KEY:
        _log("HEALTH_INGEST_API_KEY not set — aborting")
        return 1

    target_date = datetime.now(LOCAL_TZ).date()
    events = collect_events(target_date)
    gh = github_today(target_date)

    if not events and gh["commit_count"] == 0:
        _log(f"{target_date}: no Claude or GitHub activity — posting 0.0")
        post_deep_work(target_date, 0.0)
        return 0

    blocks = cluster(events)
    summary, span_min = build_summary(blocks, gh)
    _log(f"{target_date}: {len(blocks)} blocks, {span_min:.0f} span-min, {gh['commit_count']} commits")

    result = ask_claude(summary)
    if result is None:
        # Fallback: deterministic span if the agent is unavailable
        fallback = round(span_min / 60, 1)
        _log(f"agent unavailable — falling back to deterministic span: {fallback}h")
        post_deep_work(target_date, fallback)
        return 0

    _log(f"agent: {result['deep_work_hrs']}h — {result['rationale']}")
    post_deep_work(target_date, result["deep_work_hrs"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
