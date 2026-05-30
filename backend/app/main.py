import asyncio
import os
import re
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy import select

from app.routers import projects, skills, experience, about, contact, auth, blog, internships, storage, github, analytics, links, seo, kpi, claude_usage, home, about_page, status, solar, testimonial_requests
from app.routers.claude_usage import _do_snapshot as _claude_snapshot
from app.database import AsyncSessionLocal
from app import models

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

_SKIP_CACHE = frozenset({"/auth", "/internships", "/storage", "/kpi", "/links", "/claude", "/status", "/solar", "/testimonial"})

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


async def _periodic_claude_snapshot():
    """Snapshot Claude JSONL data to DB once on startup, then every 24 h."""
    import logging
    log = logging.getLogger("claude_snapshot")
    while True:
        try:
            n = await _claude_snapshot()
            log.info("Claude snapshot: %d days upserted", n)
        except Exception as exc:
            log.warning("Claude snapshot failed: %s", exc)
        await asyncio.sleep(86400)  # 24 hours


@asynccontextmanager
async def lifespan(app: FastAPI):
    await kpi.init_kpi_db()
    # Warm GitHub cache in the background so it doesn't delay startup
    asyncio.create_task(github.warmup())
    # Persist Claude usage data to DB daily so history survives JSONL pruning
    asyncio.create_task(_periodic_claude_snapshot())
    # Prime index.html cache
    _read_index_html()
    yield
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(kpi.health_ingest_router, prefix="/api")
app.include_router(claude_usage.router, prefix=API_PREFIX)
app.include_router(home.router, prefix=API_PREFIX)
app.include_router(about_page.router, prefix=API_PREFIX)
app.include_router(status.router, prefix=f"{API_PREFIX}/status")
app.include_router(solar.router, prefix=f"{API_PREFIX}/solar")
app.include_router(testimonial_requests.router)


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
        f'    <title>{title}</title>'
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

    # Serve real files (JS, CSS, images, etc.) directly
    candidate = STATIC_DIR / full_path
    if full_path and candidate.is_file():
        response = FileResponse(str(candidate))
        # Vite writes content-hashed filenames (e.g. index-DwP6FtY2.js).
        # These are safe to cache forever; the hash changes when content does.
        if re.search(r'-[A-Za-z0-9]{8}\.(js|css)$', full_path):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
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

    # All other paths → SPA entry point
    return FileResponse(str(STATIC_DIR / "index.html"))
