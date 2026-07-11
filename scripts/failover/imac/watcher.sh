#!/bin/sh
# Failover watcher — runs on the iMac.
#
# Probes the Mac mini's origin directly over Tailscale (NOT the public URL, which
# points at the iMac while failed over). When the mini is down it flips the apex
# CNAME to the iMac's tunnel; when the mini recovers it flips back. Hysteresis on
# both edges prevents flapping. State is read live from Cloudflare each cycle, so
# a watcher restart re-syncs to reality instead of assuming.
set -eu

: "${CF_API_TOKEN:?}"; : "${CF_ZONE_ID:?}"; : "${CF_RECORD_ID:?}"; : "${CF_RECORD:?}"
: "${PRIMARY_TARGET:?}"; : "${BACKUP_TARGET:?}"; : "${MINI_HEALTH_URL:?}"

INTERVAL="${INTERVAL:-30}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-3}"      # ~90s of failure before failing over
RECOVER_THRESHOLD="${RECOVER_THRESHOLD:-4}" # ~120s of health before failing back

API="https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$CF_RECORD_ID"
AUTH="Authorization: Bearer $CF_API_TOKEN"

log(){ echo "$(date -u +%FT%TZ) $*"; }
mini_up(){ curl -fsS -m 8 -o /dev/null "$MINI_HEALTH_URL" 2>/dev/null; }
get_target(){ curl -s -m 12 -H "$AUTH" "$API" | jq -r '.result.content // empty'; }
set_target(){ # $1 = cfargotunnel target
  curl -s -m 12 -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"$CF_RECORD\",\"content\":\"$1\",\"proxied\":true,\"ttl\":1}" \
    "$API" | jq -r '.success'
}

fails=0; oks=0
log "watcher start — probe=$MINI_HEALTH_URL interval=${INTERVAL}s fail>=$FAIL_THRESHOLD recover>=$RECOVER_THRESHOLD"
while true; do
  if mini_up; then oks=$((oks+1)); fails=0; else fails=$((fails+1)); oks=0; fi
  cur="$(get_target || true)"

  if [ "$fails" -ge "$FAIL_THRESHOLD" ] && [ "$cur" = "$PRIMARY_TARGET" ]; then
    log "MINI DOWN (${fails}× fail) — failover → iMac"
    if [ "$(set_target "$BACKUP_TARGET")" = "true" ]; then log "FAILOVER applied"; else log "FAILOVER patch FAILED"; fi
  elif [ "$oks" -ge "$RECOVER_THRESHOLD" ] && [ "$cur" = "$BACKUP_TARGET" ]; then
    log "MINI RECOVERED (${oks}× ok) — failback → Mini"
    if [ "$(set_target "$PRIMARY_TARGET")" = "true" ]; then log "FAILBACK applied"; else log "FAILBACK patch FAILED"; fi
  fi

  sleep "$INTERVAL"
done
