#!/usr/bin/env bash
# Detects active coding session on laptop and POSTs status to the portfolio backend.
# Active = screen is on and not locked (ScreenSaverEngine not running).
# Requires: DEV_STATUS_API_KEY env var.

API_URL="${DEV_STATUS_URL:-https://nathanblatter.com/api/v1/status/dev}"

if [ -z "$DEV_STATUS_API_KEY" ]; then
  echo "DEV_STATUS_API_KEY is not set — skipping" >&2
  exit 1
fi

# Active if a coding app was in the foreground in the last 60s
# Uses osascript to get the frontmost app name
frontmost=$(osascript -e 'tell application "System Events" to get name of first process where it is frontmost' 2>/dev/null)

case "$frontmost" in
  Terminal|iTerm2|iTerm|Cursor|"Code"|"Visual Studio Code"|Warp|Alacritty|Ghostty)
    active=true
    type="laptop"
    ;;
  *)
    active=false
    type="none"
    ;;
esac

payload="{\"active\": $active, \"type\": \"$type\", \"source\": \"laptop\"}"

http_code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DEV_STATUS_API_KEY" \
  -d "$payload" \
  --max-time 10)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) active=$active type=$type http=$http_code"
