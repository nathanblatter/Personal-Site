#!/bin/sh
# Mirror the portfolio MinIO bucket from the mini → iMac. Doubles as an off-mini
# backup of all uploaded assets AND makes images resolve during failover (served
# by Caddy at the same /api/v1/storage/download/<key> paths the site uses).
#
# Incremental (mc mirror only pulls changed/new objects). Runs on the iMac; reads
# MinIO creds from the stack .env. Kept OUT of the daily SPA snapshot's rsync
# --delete via an exclude, so the two pipelines don't clobber each other.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/.env"

: "${MINIO_ENDPOINT:?}"; : "${MINIO_ACCESS_KEY:?}"; : "${MINIO_SECRET_KEY:?}"
BUCKET="${MINIO_BUCKET:-portfolio}"
DEST="$DIR/www/api/v1/storage/download"

mkdir -p "$DEST"
mc alias set mini "http://$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
# --overwrite keeps changed objects fresh; --remove prunes deletes so the mirror
# tracks the bucket exactly (it's a mirror/backup of current state).
mc mirror --overwrite --remove "mini/$BUCKET" "$DEST"
echo "$(date -u +%FT%TZ) minio mirror complete: $(find "$DEST" -type f | wc -l | tr -d ' ') objects, $(du -sh "$DEST" | cut -f1)"
