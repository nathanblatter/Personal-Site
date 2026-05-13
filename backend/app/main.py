import os
import re
from html import escape
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy import select

from app.routers import projects, skills, experience, about, contact, auth, blog, internships, storage, github, analytics, links, seo, kpi
from app.database import AsyncSessionLocal
from app import models

# Resolve static files directory: env var → frontend/dist/ at repo root
STATIC_DIR = Path(
    os.getenv("STATIC_DIR", str(Path(__file__).parent.parent.parent / "frontend" / "dist"))
)

DOMAIN = "https://nathanblatter.com"

# Known bot user-agent patterns for OG tag injection
BOT_PATTERN = re.compile(
    r"(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot|Applebot)",
    re.IGNORECASE,
)

app = FastAPI(
    title="Portfolio API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    index_path = STATIC_DIR / "index.html"

    if not index_path.is_file():
        return JSONResponse(
            {"message": "Portfolio API is running. Frontend not built yet."},
            status_code=200,
        )

    # Serve real files (JS, CSS, images, etc.) directly
    candidate = STATIC_DIR / full_path
    if full_path and candidate.is_file():
        return FileResponse(str(candidate))

    # For blog post URLs from social crawlers, inject per-post OG tags
    if request and full_path.startswith("blog/"):
        ua = request.headers.get("user-agent", "")
        if BOT_PATTERN.search(ua):
            slug = full_path.removeprefix("blog/").rstrip("/")
            if slug:
                index_html = index_path.read_text()
                modified = await _blog_og_html(slug, index_html)
                if modified:
                    return HTMLResponse(modified)

    # All other paths → SPA entry point
    return FileResponse(str(index_path))
