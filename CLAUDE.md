# Vision

**The sole purpose of nathanblatter.com is to help Nathan with recruiting and landing jobs and consulting opportunities.**

Every public-facing feature must plausibly move a recruiter, hiring manager, or consulting lead toward contacting/hiring Nathan — kill vanity features that don't aid landing work. Exemptions: the repo also carries internal riders that serve other purposes — the KPI subsystem is explicitly protected, and the Journal subsystem is its own project (vision: Nathan's printed book this year, then productize) and will eventually be extracted into its own repo.

# Best practices (follow these on every change)

These are the conventions already established across the site. New features should match them.

## Data & content
- **No hardcoded content in components.** Anything Nathan might want to edit (certs, /now, /uses, projects, skills, about) lives in the DB with admin CRUD. Static arrays in `.tsx` files are a smell — move them to a table + router.
- **DB-backed = full CRUD + admin UI.** A new content type gets: model (`models.py`), schemas (Base/Create/Update/Response in `schemas.py`), a router with public GET + auth'd POST/PUT/DELETE, an `api.ts` client, and an admin section.
- **Seed backfills are idempotent and run before the seed guard.** Prod is already seeded (projects exist), so the `if first project: return` guard skips new data. Put backfills (`ensure_*`) above the guard and have them no-op when their own table is already populated — never overwrite admin edits.
- **Relate tables with real FKs.** Use `ForeignKey(..., ondelete=...)` + a SQLAlchemy `relationship`. Clean up dependents on delete (e.g. a cert deletes its auto-created tracked link).

## Caching
- Aggregate read endpoints (e.g. `/about-page`, `/home`) cache the assembled payload in Redis via `app.cache` with a TTL (~300s). The frontend makes **one** call per page, not N.
- **Bust the cache on every write.** Admin POST/PUT/DELETE must `await cache.delete("page:about")` (or the relevant key) so edits show immediately.
- Endpoints that must never be cached at the HTTP layer go in `_SKIP_CACHE` in `main.py`.

## Frontend loading & perf
- **Skeletons, not spinners.** Every async section renders a content-shaped skeleton (`Skeleton` component or `animate-pulse` blocks) matching the real layout's dimensions while `loading`. No layout shift.
- **Lazy-load routes.** Pages are `lazy()` + `<Suspense>` in `App.tsx`; keep new pages code-split.
- **Lazy-load images.** `<img loading="lazy">` for below-the-fold images; `decoding="async"`. Give an `onError` fallback for user-supplied/remote images.
- **Tree-shake icons.** Import named icons from `lucide-react` (never `import * as`); the curated registry is `lib/iconMap.ts`.
- **Respect motion preferences** — the app is wrapped in `<MotionConfig reducedMotion="user">`.

## Tracked links & uploads
- User-facing outbound links that should be measured go through the tracked-link system: create a `TrackedLink` and link to `/go/{slug}` (redirects + counts clicks + fires Umami/iMessage). Auto-create these as a side effect when a verify/destination URL is entered.
- Images go to object storage via `api.storage.upload(file, prefix)` → `{key, url}`. Store **both** the display `image_url` and the `image_key`. Use `FileUploadButton` in admin UIs.

## Admin UX (already built — reuse, don't reinvent)
- `useUnsavedWarning(dirty)` for unsaved-change guards, `useDragReorder` for sort_order DnD, `Toast` with an optional undo action for destructive ops, `⌘K` command palette, persisted theme/section/density. Match these patterns in new sections.

# Admin sign-in (Squawk)

`/admin/login` signs in through **Squawk**, Nathan's auth service (`SQUAWK_ISSUER`, currently
`https://squawk.nathanblatter.com`; the hostname is an env var because it was just renamed from
`auth.`). The site is registered there as an invite-only user pool (`open_signup=false`), so the
only accounts that exist are the ones Nathan provisions — "any verified user" = Nathan.

- **Flow (Hydra-style, `backend/app/routers/auth.py` + `backend/app/squawk.py`):** the page's
  "Sign in" button hits `GET /api/v1/auth/start`, which stashes a PKCE verifier + `state` in Redis
  (5 min) and 302s to Squawk `/oauth/authorize` (`scope=admin`, `resource=SQUAWK_RESOURCE`).
  Squawk parks the request and sends the browser back to `/admin/login?login_challenge=…`. The
  page then offers **passkey** (`POST /auth/passkey/begin|finish`, WebAuthn bound to
  `nathanblatter.com`) or **emailed 6-digit code** (`POST /auth/email/begin|finish`); the backend
  proxies these to Squawk `/v1/login/*` with a cached **service token** (client_credentials with
  `SQUAWK_SERVICE_ID` + `SQUAWK_CREDENTIAL`, refreshed 30 s before expiry). `finish` returns
  `redirect_to` → Squawk → `GET /auth/callback?code&state`: exchange at `/oauth/token`, verify the
  ES256 user token against Squawk's JWKS (`iss`, `aud == SQUAWK_SERVICE_ID`, `exp`, `sub` is
  `usr:…`, `email_verified`), then mint the site's own `auth_token` cookie (`app.auth.create_token`,
  `sub` = Squawk user id) and land on `/admin`. Failures redirect to `/admin/login?error=<code>`.
- **Env:** `SQUAWK_ISSUER`, `SQUAWK_SERVICE_ID`, `SQUAWK_CREDENTIAL`, `SQUAWK_CLIENT_ID`
  (public PKCE client, redirect_uri `https://nathanblatter.com/api/v1/auth/callback`),
  `SQUAWK_RESOURCE`, optional `SITE_URL`. All documented in `backend/.env.example`.
  **`SQUAWK_ISSUER` unset = local dev**: everything degrades to the old username/password login.
- **Break-glass:** `ADMIN_PASSWORD_LOGIN=true` keeps `POST /auth/login` (username/password) reachable
  while Squawk is configured; otherwise it answers 404. `GET /auth/config` tells the page which
  mode is on. The per-IP throttle (`LOGIN_MAX_ATTEMPTS`/`LOGIN_WINDOW_SECONDS`) applies to the
  Squawk proxy endpoints too; Squawk has its own limits on top.
- **Provisioning an account** happens in the **Squawk console**, not on this site: owner →
  service `personal-site` → users → create (method passkey or email; the user then registers a
  passkey through Squawk). `~/dev/auth-service/docs/API.md` "End users" has the details.
  Revoke/disable there as well.
- **Verify:** `cd backend && python -c "import app.main" && pytest -q tests`
  (`tests/test_auth_squawk.py` mocks Squawk with `httpx.MockTransport` and mints ES256 test tokens).

# Repo location

- **Canonical checkout: `~/dev/Personal-Site`.** `~/Desktop/Personal-Site` is only a symlink to it (moved 2026-09-19). iCloud Drive syncs ~/Desktop and evicts files, which hung `npx`/`eslint`/`vite` locally and blocked the CI runner's file opens for six hours. Never clone or build under ~/Desktop or ~/Documents.

# CI/CD

- **Org:** github.com/nathanblatter
- **Runner:** Native macOS GitHub Actions runner on Mac Mini (launchd service at ~/actions-runner)
- **Deploy trigger:** Push to `main` branch
- **Deploy workflow:** `.github/workflows/deploy.yml` — checks out the pushed SHA into the runner workspace, runs the gates (eslint, tsc + vite build, image import smoke-checks, pytest inside the built api image), then zero-downtime compose rollout + seed. `--project-directory` points at `~/deploy/Personal-Site/backend` only to resolve `.env.prod` — that copy lives **outside iCloud** on purpose (the runner is launchd-spawned and iCloud blocks its file opens: Aug 29 EDEADLK failure, Sep 19 six-hour hang). If you rotate a secret, update `~/deploy/Personal-Site/backend/.env.prod`; the `backend/.env.prod` in this checkout is for local use.
- **Commit completeness matters:** the 2026-08-01 failed deploy was a partial commit (main.py imported `routers/privacy.py` which was never `git add`ed). The import smoke-check in deploy.yml now catches this before rollout — but always `git status` before pushing.
- **Secrets:** `~/deploy/Personal-Site/backend/.env.prod` on the Mac mini (prod, non-iCloud); `backend/.env.prod` here is a gitignored local copy
- **Infrastructure:** Docker Compose (FastAPI backend), shared Postgres from docker-services, frontend served separately
