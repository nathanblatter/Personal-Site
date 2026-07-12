#!/usr/bin/env bash
# Set up the native MLX Whisper transcription service on the Mac mini host.
# One-time host setup (NOT part of the Docker deploy) — the journal-worker container
# delegates transcription to this service on the M4 GPU, falling back to its own CPU
# whisper if this is down. Re-running is safe (idempotent).
set -euo pipefail

REPO="/Users/nathanblatter/Desktop/Personal-Site"
VENV="$HOME/journal-mlx/venv"
PLIST_SRC="$REPO/backend/deploy/com.nathanblatter.journal-mlx.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.nathanblatter.journal-mlx.plist"

echo "==> ffmpeg (mlx_whisper decodes audio via ffmpeg)"
command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg

echo "==> python venv + mlx-whisper stack at $VENV"
[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet mlx-whisper fastapi "uvicorn[standard]" python-multipart

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
