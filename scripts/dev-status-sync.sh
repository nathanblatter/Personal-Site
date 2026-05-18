#!/usr/bin/env bash
# Detects active SSH/VNC sessions and POSTs status to the portfolio backend.
# Requires: DEV_STATUS_API_KEY env var and DEV_STATUS_URL (defaults to prod).

API_URL="${DEV_STATUS_URL:-https://nathanblatter.com/api/v1/status/dev}"

if [ -z "$DEV_STATUS_API_KEY" ]; then
  echo "DEV_STATUS_API_KEY is not set — skipping" >&2
  exit 1
fi

# SSH: remote sessions appear as pts/* with a remote IP in parentheses
ssh_count=$(who 2>/dev/null | awk '$2 ~ /^pts\// && $NF ~ /\(.*[0-9].*\)/' | wc -l | tr -d ' ')

# VNC/Screen Sharing: ScreensharingAgent only exists during an active session
vnc_count=0
pgrep -x ScreensharingAgent > /dev/null 2>&1 && vnc_count=1

has_ssh=false
has_vnc=false
[ "$ssh_count" -gt 0 ] && has_ssh=true
[ "$vnc_count" -gt 0 ] && has_vnc=true

if $has_ssh && $has_vnc; then
  type="both"
  active=true
elif $has_ssh; then
  type="ssh"
  active=true
elif $has_vnc; then
  type="vnc"
  active=true
else
  type="none"
  active=false
fi

payload="{\"active\": $active, \"type\": \"$type\", \"source\": \"mini\"}"

http_code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DEV_STATUS_API_KEY" \
  -d "$payload" \
  --max-time 10)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) active=$active type=$type http=$http_code"
