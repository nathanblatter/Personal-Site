import asyncio
import json as _json
import logging
import mimetypes
import os
import re
import time
from contextlib import asynccontextmanager
from difflib import SequenceMatcher
from html import escape
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from sqlalchemy import select

from app.routers import projects, skills, experience, about, contact, auth, blog, internships, storage, github, analytics, links, seo, kpi, claude_usage, home, about_page, contact_page, status, solar, testimonial_requests, rss, resume, bookings, bio, crm, bug_report
from app.routers.claude_usage import _do_snapshot as _claude_snapshot
from app.database import AsyncSessionLocal
from app import models

class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            obj["exc"] = self.formatException(record.exc_info)
        return _json.dumps(obj, default=str)

_handler = logging.StreamHandler()
_handler.setFormatter(_JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
log = logging.getLogger(__name__)

# Resolve static files directory: env var → frontend/dist/ at repo root
STATIC_DIR = Path(
    os.getenv("STATIC_DIR", str(Path(__file__).parent.parent.parent / "frontend" / "dist"))
)

DOMAIN = "https://nathanblatter.com"

# index.html in-memory cache: {"content": str, "mtime": float}
_index_cache: dict = {}

# Per-route OG metadata for social crawler injection
_STATIC_OG: dict[str, dict[str, str]] = {
    "": {
        "title": "Nathan Blatter — Portfolio",
        "description": "IS student at BYU building full-stack applications, AI systems, and research tools.",
        "url": f"{DOMAIN}/",
    },
    "about": {
        "title": "About — Nathan Blatter",
        "description": "Information Systems student at BYU. Full-stack engineer, AI developer, and data analyst.",
        "url": f"{DOMAIN}/about",
    },
    "projects": {
        "title": "Projects — Nathan Blatter",
        "description": "Selected work from research, coursework, and real-world clients.",
        "url": f"{DOMAIN}/projects",
    },
    "contact": {
        "title": "Contact — Nathan Blatter",
        "description": "Open to internships, collaborations, and interesting projects.",
        "url": f"{DOMAIN}/contact",
    },
    "resume": {
        "title": "Résumé — Nathan Blatter",
        "description": "Full-stack engineer skilled in Python, React, SQL, and AI systems.",
        "url": f"{DOMAIN}/resume",
    },
    "blog": {
        "title": "Blog — Nathan Blatter",
        "description": "Technical writing on software engineering, AI, and data systems.",
        "url": f"{DOMAIN}/blog",
    },
}

_SKIP_CACHE = frozenset({"/auth", "/internships", "/storage", "/kpi", "/links", "/claude", "/status", "/solar", "/testimonial", "/bookings", "/bio"})

# Known bot user-agent patterns for OG tag injection
BOT_PATTERN = re.compile(
    r"(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot|Applebot)",
    re.IGNORECASE,
)

def _read_index_html() -> str | None:
    """Return index.html contents, re-reading from disk only when the file has changed."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.is_file():
        return None
    mtime = index_path.stat().st_mtime
    if _index_cache.get("mtime") != mtime:
        _index_cache["content"] = index_path.read_text()
        _index_cache["mtime"] = mtime
    return _index_cache["content"]


async def _supervised(name: str, coro_fn, interval: int, max_retries: int = 3):
    """Run a coroutine on an interval with auto-retry and backoff on failure."""
    logger = logging.getLogger(name)
    consecutive_failures = 0
    while True:
        try:
            result = await coro_fn()
            logger.info("%s completed: %s", name, result)
            consecutive_failures = 0
        except Exception as exc:
            consecutive_failures += 1
            backoff = min(interval, 60 * (2 ** consecutive_failures))
            logger.warning("%s failed (attempt %d): %s — retrying in %ds",
                           name, consecutive_failures, exc, backoff)
            if consecutive_failures <= max_retries:
                await asyncio.sleep(backoff)
                continue
            logger.error("%s exceeded %d retries, waiting for next interval", name, max_retries)
            consecutive_failures = 0
        await asyncio.sleep(interval)


async def _periodic_claude_snapshot():
    return f"{await _claude_snapshot()} days upserted"


async def _periodic_github_kpi():
    daily = await kpi.scrape_github_kpi()
    return f"{len(daily)} days updated"


async def _periodic_booking_cleanup():
    return await bookings.auto_decline_expired()


async def _periodic_booking_reminders():
    return await bookings.send_booking_reminders()


async def _periodic_crm_reminders():
    return await crm.send_crm_reminders()


async def _periodic_church_reminder():
    return await kpi.send_church_reminder()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await kpi.init_kpi_db()
    _tasks = [
        asyncio.create_task(github.warmup()),
        asyncio.create_task(_supervised("claude_snapshot", _periodic_claude_snapshot, 86400)),
        asyncio.create_task(_supervised("github_kpi", _periodic_github_kpi, 21600)),
        asyncio.create_task(_supervised("booking_cleanup", _periodic_booking_cleanup, 3600)),
        asyncio.create_task(_supervised("booking_reminders", _periodic_booking_reminders, 600)),
        asyncio.create_task(_supervised("crm_reminders", _periodic_crm_reminders, 21600)),
        asyncio.create_task(_supervised("church_reminder", _periodic_church_reminder, 600)),
    ]
    _read_index_html()
    yield
    for t in _tasks:
        t.cancel()
    await kpi.close_kpi_db()


def _static_og_html(route: str, index_html: str) -> str | None:
    og = _STATIC_OG.get(route)
    if og is None:
        return None
    title = escape(og["title"])
    desc = escape(og["description"])
    url = og["url"]
    image = f"{DOMAIN}/headshot.webp"
    og_tags = (
        f'<meta property="og:title" content="{title}" />\n'
        f'    <meta property="og:description" content="{desc}" />\n'
        f'    <meta property="og:image" content="{image}" />\n'
        f'    <meta property="og:url" content="{url}" />\n'
        f'    <meta property="og:type" content="website" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:title" content="{title}" />\n'
        f'    <meta name="twitter:description" content="{desc}" />\n'
        f'    <meta name="twitter:image" content="{image}" />\n'
        f'    <title>{title}</title>'
    )
    html = re.sub(r'<title>[^<]*</title>', '', index_html, count=1)
    html = re.sub(
        r'<!-- Open Graph -->.*?<!-- Twitter Card -->.*?<meta name="twitter:image"[^>]*/>',
        og_tags,
        html,
        flags=re.DOTALL,
    )
    return html


app = FastAPI(
    title="Portfolio API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_req_log = logging.getLogger("request")


@app.middleware("http")
async def request_logging(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000)
    if request.url.path.startswith("/api/"):
        ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "-")
        _req_log.info(
            _json.dumps({
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "ms": duration_ms,
                "ip": ip,
            })
        )
    return response


CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.github.com https://ip-api.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Content-Security-Policy"] = CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def add_public_cache_control(request: Request, call_next):
    response = await call_next(request)
    if (
        request.method == "GET"
        and request.url.path.startswith("/api/v1/")
        and response.status_code == 200
        and not any(seg in request.url.path for seg in _SKIP_CACHE)
    ):
        response.headers.setdefault("Cache-Control", "public, max-age=60")
    return response

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(skills.router, prefix=API_PREFIX)
app.include_router(experience.router, prefix=API_PREFIX)
app.include_router(about.router, prefix=API_PREFIX)
app.include_router(contact.router, prefix=API_PREFIX)
app.include_router(blog.router, prefix=API_PREFIX)
app.include_router(internships.router, prefix=API_PREFIX)
app.include_router(storage.router, prefix=API_PREFIX)
app.include_router(github.router, prefix=API_PREFIX)
app.include_router(analytics.router)
app.include_router(links.router)
app.include_router(seo.router)
app.include_router(kpi.router, prefix=API_PREFIX)
app.include_router(bug_report.router, prefix=API_PREFIX)
app.include_router(kpi.health_ingest_router, prefix="/api")
app.include_router(kpi.church_link_router)
app.include_router(claude_usage.router, prefix=API_PREFIX)
app.include_router(home.router, prefix=API_PREFIX)
app.include_router(about_page.router, prefix=API_PREFIX)
app.include_router(contact_page.router, prefix=API_PREFIX)
app.include_router(status.router, prefix=f"{API_PREFIX}/status")
app.include_router(solar.router, prefix=f"{API_PREFIX}/solar")
app.include_router(testimonial_requests.router)
app.include_router(rss.router)
app.include_router(resume.router, prefix=API_PREFIX)
app.include_router(bookings.router, prefix=API_PREFIX)
app.include_router(bio.router, prefix=API_PREFIX)
app.include_router(crm.router, prefix=API_PREFIX)


@app.get("/api/v1/suggest", include_in_schema=False)
async def suggest_page(path: str = ""):
    """Fuzzy-match a dead URL against known routes, blog slugs, and project IDs."""
    path = path.strip("/").lower()
    if not path:
        return {"suggestion": None}

    candidates: list[str] = []

    # Static routes
    for route in ("about", "projects", "blog", "contact", "resume"):
        candidates.append(route)

    # Blog slugs
    async with AsyncSessionLocal() as db:
        blog_rows = await db.execute(
            select(models.BlogPost.slug).where(models.BlogPost.published == True)  # noqa: E712
        )
        for (slug,) in blog_rows.all():
            candidates.append(f"blog/{slug}")

        proj_rows = await db.execute(select(models.Project.project_id))
        for (pid,) in proj_rows.all():
            candidates.append(f"projects/{pid}")

    best_match = None
    best_score = 0.0
    for c in candidates:
        score = SequenceMatcher(None, path, c).ratio()
        if score > best_score:
            best_score = score
            best_match = c

    if best_score >= 0.4:
        return {"suggestion": f"/{best_match}", "score": round(best_score, 2)}
    return {"suggestion": None}


async def _blog_og_html(slug: str, index_html: str) -> str | None:
    """If slug matches a blog post, return index.html with injected OG tags."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(models.BlogPost).where(models.BlogPost.slug == slug)
        )
        post = result.scalar_one_or_none()
    if not post:
        return None

    title = escape(f"{post.title} — Nathan Blatter")
    desc = escape(post.excerpt or post.subtitle or post.title)
    url = f"{DOMAIN}/blog/{post.slug}"
    image = f"{DOMAIN}/og/{post.slug}.png"

    jsonld = _json.dumps({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.excerpt or post.subtitle or post.title,
        "url": url,
        "image": image,
        "datePublished": post.published_at,
        "dateModified": post.updated_at,
        "author": {"@type": "Person", "name": "Nathan Blatter", "url": DOMAIN},
    })

    og_tags = (
        f'<meta property="og:title" content="{title}" />\n'
        f'    <meta property="og:description" content="{desc}" />\n'
        f'    <meta property="og:image" content="{image}" />\n'
        f'    <meta property="og:url" content="{url}" />\n'
        f'    <meta property="og:type" content="article" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:title" content="{title}" />\n'
        f'    <meta name="twitter:description" content="{desc}" />\n'
        f'    <meta name="twitter:image" content="{image}" />\n'
        f'    <title>{title}</title>\n'
        f'    <script type="application/ld+json">{jsonld}</script>'
    )

    # Replace default OG tags and title
    html = re.sub(r'<title>[^<]*</title>', '', index_html, count=1)
    html = re.sub(
        r'<!-- Open Graph -->.*?<!-- Twitter Card -->.*?<meta name="twitter:image"[^>]*/>',
        og_tags,
        html,
        flags=re.DOTALL,
    )
    return html


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str = "", request: Request = None):
    index_html = _read_index_html()

    if index_html is None:
        return JSONResponse(
            {"message": "Portfolio API is running. Frontend not built yet."},
            status_code=200,
        )

    # Serve real files (JS, CSS, images, etc.) directly.
    # Read synchronously to avoid OSError 35 (resource deadlock) on macOS Docker bind mounts,
    # which occurs when anyio's thread pool reads from VirtioFS volumes.
    candidate = STATIC_DIR / full_path
    if full_path and candidate.is_file():
        content = candidate.read_bytes()
        media_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        response = Response(content=content, media_type=media_type)
        # Vite writes content-hashed filenames (e.g. index-DwP6FtY2.js).
        # These are safe to cache forever; the hash changes when content does.
        # CDN-Cache-Control tells Cloudflare to cache independently of browser cache.
        if re.search(r'-[A-Za-z0-9]{8}\.(js|css)$', full_path):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            response.headers["CDN-Cache-Control"] = "public, max-age=31536000, immutable"
        elif full_path.endswith(('.webp', '.png', '.jpg', '.svg', '.ico', '.gif', '.woff2', '.woff')):
            response.headers["Cache-Control"] = "public, max-age=604800"
            response.headers["CDN-Cache-Control"] = "public, max-age=2592000"  # 30 days at CDN
        return response

    # For social crawlers, inject per-route OG tags
    if request and BOT_PATTERN.search(request.headers.get("user-agent", "")):
        route = full_path.rstrip("/")
        if route.startswith("blog/"):
            slug = route.removeprefix("blog/")
            if slug:
                modified = await _blog_og_html(slug, index_html)
                if modified:
                    return HTMLResponse(modified)
        else:
            modified = _static_og_html(route, index_html)
            if modified:
                return HTMLResponse(modified)

    # All other paths → SPA entry point (use in-memory content, avoids FileResponse thread I/O)
    return HTMLResponse(index_html)
