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

# CI/CD

- **Org:** github.com/nathanblatter
- **Runner:** Native macOS GitHub Actions runner on Mac Mini (launchd service at ~/actions-runner)
- **Deploy trigger:** Push to `main` branch
- **Deploy workflow:** `.github/workflows/deploy.yml` — checks out the pushed SHA into the runner workspace, builds frontend + Docker images from that clean checkout (never from this working tree), smoke-checks imports, then zero-downtime compose rollout + seed. `--project-directory` still points at `~/Desktop/Personal-Site/backend` only to resolve `.env.prod`.
- **Commit completeness matters:** the 2026-08-01 failed deploy was a partial commit (main.py imported `routers/privacy.py` which was never `git add`ed). The import smoke-check in deploy.yml now catches this before rollout — but always `git status` before pushing.
- **Secrets:** `backend/.env.prod` file on host (gitignored)
- **Infrastructure:** Docker Compose (FastAPI backend), shared Postgres from docker-services, frontend served separately
