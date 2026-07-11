#!/usr/bin/env bash
#
# failover-snapshot.sh — daily static mirror of nathanblatter.com → iMac NAS.
#
# Snapshots the built SPA (frontend/dist) plus a point-in-time copy of every
# PUBLIC read-only API endpoint the site fetches, patches the SPA into
# read-only "failover" mode, and atomically ships it to the iMac, which serves
# it if the Mac mini (primary origin) goes down.
#
# Privacy: private/auth-gated surfaces are deliberately NOT mirrored — no KPI,
# status, solar, claude usage, CRM, internships, bio links, or any auth route.
# Only the public content a logged-out visitor already sees is captured.
#
# Safe by construction: the new snapshot is validated locally before anything
# on the iMac is touched, then swapped in atomically. A bad build can never
# replace a good mirror.

set -euo pipefail

# ---- config ---------------------------------------------------------------
SITE="${SITE:-https://nathanblatter.com}"
REPO="${REPO:-/Users/nathanblatter/Desktop/Personal-Site}"
DIST="$REPO/frontend/dist"
IMAC="${IMAC:-nathan@100.126.147.122}"
REMOTE_BASE="${REMOTE_BASE:-/home/nathan/site-failover}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)
CURL=(curl -fsS --max-time 20 --retry 2 --retry-delay 2)

# Public GET endpoints (relative to /api/v1) the SPA renders from.
# Intentionally excludes: kpi, status, solar, claude/usage, links, bio/links,
# and every auth/CRM/internships/bookings/newsletter write surface.
ENDPOINTS=(
  home about-page contact-page
  projects skills experience
  about about/interests about/coursework about/certifications about/testimonials
  contact contact/socials
  blog bio bio/settings/public
  resume/data resume/variants
  github/profile github/repos github/contributions
)

log() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { printf '\033[31mERROR\033[0m %s\n' "$*" >&2; exit 1; }

# ---- stage ----------------------------------------------------------------
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/failover-snap.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

[ -f "$DIST/index.html" ] || die "no built frontend at $DIST (run npm run build)"

log "copying SPA build → stage"
cp -R "$DIST/." "$STAGE/"

log "snapshotting public API endpoints"
API="$STAGE/api/v1"
fetch() { # fetch <relpath>  -> writes $API/<relpath>.json
  # Stored with a .json suffix so a collection ("about") and its sub-resources
  # ("about/interests") never collide as file-vs-directory. Caddy maps the
  # extension-less request path back to the .json file via try_files.
  local ep="$1" out="$API/$1.json"
  mkdir -p "$(dirname "$out")"
  if "${CURL[@]}" "$SITE/api/v1/$ep" -o "$out" 2>/dev/null; then
    log "  ok   /api/v1/$ep ($(wc -c <"$out" | tr -d ' ') b)"
  else
    log "  SKIP /api/v1/$ep (non-200)"
    rm -f "$out"
  fi
}
for ep in "${ENDPOINTS[@]}"; do fetch "$ep"; done

# Individual blog posts (keyed by slug).
if [ -f "$API/blog.json" ]; then
  while IFS= read -r slug; do
    [ -n "$slug" ] && fetch "blog/$slug"
  done < <(python3 -c "import sys,json;d=json.load(open('$API/blog.json'));i=d if isinstance(d,list) else d.get('posts',[]);[print(p['slug']) for p in i if p.get('slug')]" 2>/dev/null)
fi

# Runtime failover marker — served only by the mirror (the live mini 404s this),
# so the frontend can detect a mid-session failover and disable write forms.
printf '{"failover":true}' > "$API/__failover.json"

# ---- patch SPA into failover (read-only) mode -----------------------------
log "injecting window.__FAILOVER__ flag into index.html"
python3 - "$STAGE/index.html" <<'PY'
import sys, re
p = sys.argv[1]
html = open(p, encoding="utf-8").read()
flag = "<script>window.__FAILOVER__=true;</script>"
if "__FAILOVER__" not in html:
    html = re.sub(r"(<head[^>]*>)", r"\1" + flag, html, count=1)
open(p, "w", encoding="utf-8").write(html)
PY

# ---- validate before touching the iMac ------------------------------------
log "validating snapshot"
[ -s "$API/home.json" ] || die "missing/empty /api/v1/home — refusing to publish"
python3 -c "import json;json.load(open('$API/home.json'))" || die "/api/v1/home is not valid JSON"
[ "$(wc -c <"$API/home.json" | tr -d ' ')" -ge 500 ] || die "/api/v1/home suspiciously small"
grep -q "__FAILOVER__" "$STAGE/index.html" || die "failover flag not injected"
log "snapshot OK: $(find "$API" -type f | wc -l | tr -d ' ') API files, $(du -sh "$STAGE" | cut -f1) total"

# ---- ship atomically to the iMac ------------------------------------------
log "shipping to $IMAC:$REMOTE_BASE"
ssh "${SSH_OPTS[@]}" "$IMAC" "mkdir -p '$REMOTE_BASE'" \
  || die "cannot reach iMac over SSH"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$STAGE/" "$IMAC:$REMOTE_BASE/www.tmp/" \
  || die "rsync failed"
ssh "${SSH_OPTS[@]}" "$IMAC" "
  set -e
  cd '$REMOTE_BASE'
  rm -rf www.old
  [ -d www ] && mv www www.old || true
  mv www.tmp www
  rm -rf www.old
" || die "atomic swap on iMac failed"

log "done — mirror published to $IMAC:$REMOTE_BASE/www"
