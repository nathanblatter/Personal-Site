#!/usr/bin/env bash
# Usage: ./scripts/contact-redis.sh [reset-ip <ip>] [reset-daily]

REDIS="docker exec docker-services-redis-1 redis-cli"

case "$1" in
  reset-ip)
    $REDIS del "contact:ip:$2"
    echo "Cleared rate limit for $2"
    ;;
  reset-daily)
    $REDIS del "contact:daily:$(date +%F)"
    echo "Cleared daily counter for today"
    ;;
  *)
    echo "=== Contact Redis Status ==="
    DAILY=$($REDIS get "contact:daily:$(date +%F)")
    DAILY_TTL=$($REDIS ttl "contact:daily:$(date +%F)")
    echo "Daily emails today: ${DAILY:-0} / 100  (resets in ${DAILY_TTL}s)"
    echo ""
    echo "Blocked IPs:"
    IPS=$($REDIS keys "contact:ip:*")
    if [ -z "$IPS" ]; then
      echo "  (none)"
    else
      while IFS= read -r key; do
        COUNT=$($REDIS get "$key")
        TTL=$($REDIS ttl "$key")
        IP="${key#contact:ip:}"
        echo "  $IP — $COUNT requests, unblocks in ${TTL}s"
      done <<< "$IPS"
    fi
    ;;
esac
