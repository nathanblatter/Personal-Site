#!/usr/bin/env bash
# Set up the native MLX Whisper transcription service on the Mac mini host.
# One-time host setup (NOT part of the Docker deploy) — the journal-worker container
# delegates transcription to this service on the M4 GPU, falling back to its own CPU
# whisper if this is down. Re-running is safe (idempotent).
set -euo pipefail

# Resolve the repo from this script's location (canonical checkout is ~/dev/Personal-Site;
# never hardcode ~/Desktop, which is iCloud-managed).
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Build the venv from Homebrew's versioned opt path: it survives patch upgrades, unlike a
# pyenv build (the 2026-10-19 outage was a venv pointing at a deleted ~/.pyenv Python).
PYTHON="${JOURNAL_MLX_PYTHON:-/opt/homebrew/opt/python@3.14/bin/python3.14}"
VENV="$HOME/journal-mlx/venv"
PLIST_SRC="$REPO/backend/deploy/com.nathanblatter.journal-mlx.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.nathanblatter.journal-mlx.plist"

echo "==> ffmpeg (mlx_whisper decodes audio via ffmpeg)"
command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg

echo "==> python venv + mlx-whisper stack at $VENV"
# Rebuild if the venv is missing OR its interpreter no longer runs (dangling symlink).
if ! "$VENV/bin/python" -c 'import sys' >/dev/null 2>&1; then
  if [ -e "$VENV" ]; then
    echo "    existing venv is broken; moving it to $VENV.broken-$(date +%Y%m%d%H%M%S)"
    mv "$VENV" "$VENV.broken-$(date +%Y%m%d%H%M%S)"
  fi
  "$PYTHON" -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet mlx-whisper fastapi "uvicorn[standard]" python-multipart

echo "==> app code → ~/journal-mlx (outside iCloud-managed ~/Desktop; running from the repo dies with EDEADLK when iCloud evicts files)"
cp "$REPO/backend/app/journal_mlx_server.py" "$HOME/journal-mlx/journal_mlx_server.py"

echo "==> launchd service"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "==> waiting for health…"
for _ in $(seq 1 15); do
  if curl -sf http://127.0.0.1:4310/health >/dev/null; then
    echo "OK: $(curl -s http://127.0.0.1:4310/health)"
    exit 0
  fi
  sleep 1
done
echo "service did not become healthy; check /tmp/journal-mlx.log" >&2
exit 1
