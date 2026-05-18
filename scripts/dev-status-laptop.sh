#!/usr/bin/env bash
# Detects active coding session on laptop and POSTs status to the portfolio backend.
# Active = screen is on and not locked (ScreenSaverEngine not running).
# Requires: DEV_STATUS_API_KEY env var.

API_URL="${DEV_STATUS_URL:-https://nathanblatter.com/api/v1/status/dev}"

if [ -z "$DEV_STATUS_API_KEY" ]; then
  echo "DEV_STATUS_API_KEY is not set — skipping" >&2
  exit 1
fi

# Screen is locked/sleeping if ScreenSaverEngine is running
if pgrep -x "ScreenSaverEngine" > /dev/null 2>&1; then
  active=false
  type="none"
else
  active=true
  type="laptop"
fi

payload="{\"active\": $active, \"type\": \"$type\", \"source\": \"laptop\"}"

http_code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DEV_STATUS_API_KEY" \
  -d "$payload" \
  --max-time 10)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) active=$active type=$type http=$http_code"
