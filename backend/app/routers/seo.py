import io
import re
import textwrap
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image, ImageDraw, ImageFont

from app.database import get_db
from app import models

router = APIRouter(tags=["seo"])

DOMAIN = "https://nathanblatter.com"


def clean_description(text: str | None, limit: int = 160) -> str:
    """Flatten markdown/whitespace into a clean meta description, truncated on a word boundary."""
    if not text:
        return ""
    # Strip the most common markdown noise so previews read as prose, not source.
    flat = re.sub(r"[#*_`>~\[\]()]", " ", text)
    flat = re.sub(r"\s+", " ", flat).strip()
    if len(flat) <= limit:
        return flat
    return flat[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"

STATIC_PAGES = [
    "/",
    "/about",
    "/projects",
    "/blog",
    "/resume",
    "/contact",
]

# OG images are binary blobs — keep in-memory (not worth serializing to Redis)
_og_cache: dict[str, bytes] = {}


def _generate_og_image(title: str, tags: list[str], subtitle: str = "") -> bytes:
    """Generate a 1200x630 OG image with title, tags, and branding."""
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), "#0d1117")
    draw = ImageDraw.Draw(img)

    # Try to load a nice font, fall back to default
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        font_tag = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 18)
        font_brand = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 20)
    except OSError:
        font_title = ImageFont.load_default(48)
        font_sub = ImageFont.load_default(24)
        font_tag = ImageFont.load_default(18)
        font_brand = ImageFont.load_default(20)

    # Accent bar at top
    draw.rectangle([(0, 0), (w, 6)], fill="#3b6cf5")

    # Title — word wrap
    wrapped = textwrap.wrap(title, width=32)
    y = 120
    for line in wrapped[:3]:
        draw.text((80, y), line, fill="#e6edf3", font=font_title)
        y += 62

    # Subtitle
    if subtitle:
        sub_wrapped = textwrap.wrap(subtitle, width=55)
        y += 10
        for line in sub_wrapped[:2]:
            draw.text((80, y), line, fill="#8b949e", font=font_sub)
            y += 34

    # Tags
    tag_y = h - 140
    tag_x = 80
    for tag in tags[:5]:
        text = tag.upper()
        bbox = draw.textbbox((0, 0), text, font=font_tag)
        tw = bbox[2] - bbox[0]
        # Tag pill
        draw.rounded_rectangle(
            [(tag_x, tag_y), (tag_x + tw + 24, tag_y + 32)],
            radius=16,
            fill="#1c2333",
        )
        draw.text((tag_x + 12, tag_y + 5), text, fill="#8b949e", font=font_tag)
        tag_x += tw + 36
        if tag_x > w - 100:
            break

    # Branding
    draw.text((80, h - 70), "nathanblatter.com", fill="#3b6cf5", font=font_brand)

    # NB logo box
    draw.rounded_rectangle([(w - 140, h - 80), (w - 80, h - 40)], radius=8, fill="#3b6cf5")
    draw.text((w - 126, h - 76), "NB", fill="#ffffff", font=font_brand)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()



@router.get("/og/{slug}.png", include_in_schema=False)
async def og_image(slug: str, db: AsyncSession = Depends(get_db)):
    if slug in _og_cache:
        return Response(content=_og_cache[slug], media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})

    result = await db.execute(
        select(models.BlogPost).where(models.BlogPost.slug == slug)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    png = _generate_og_image(post.title, post.tags or [], post.subtitle or "")
    _og_cache[slug] = png
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/og/project/{project_id}.png", include_in_schema=False)
async def project_og_image(project_id: str, db: AsyncSession = Depends(get_db)):
    """Branded OG card for a case study (title + tags + one-line summary)."""
    cache_key = f"project:{project_id}"
    if cache_key in _og_cache:
        return Response(content=_og_cache[cache_key], media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})

    result = await db.execute(
        select(models.Project).where(models.Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    png = _generate_og_image(project.title, project.tags or [], clean_description(project.description, 90))
    _og_cache[cache_key] = png
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/og/page/{slug}.png", include_in_schema=False)
async def page_og_image(slug: str):
    """Branded OG card for a static content page (driven by the title/description map)."""
    cache_key = f"page:{slug}"
    if cache_key in _og_cache:
        return Response(content=_og_cache[cache_key], media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})

    meta = PAGE_OG.get(slug)
    if not meta:
        raise HTTPException(status_code=404, detail="Page not found")

    png = _generate_og_image(meta["title"], meta.get("tags", []), meta.get("subtitle", ""))
    _og_cache[cache_key] = png
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


# Branded-OG-image source for static pages. Keyed by route (no leading slash).
# Home and About intentionally omitted — those share the personal headshot.
PAGE_OG: dict[str, dict] = {
    "projects": {"title": "Projects", "subtitle": "Selected work from research, coursework, and real-world clients.", "tags": ["portfolio", "engineering", "case studies"]},
    "blog": {"title": "Blog", "subtitle": "Technical writing on software engineering, AI, and data systems.", "tags": ["writing", "ai", "software"]},
    "resume": {"title": "Résumé", "subtitle": "Full-stack engineer — Python, React, SQL, and AI systems.", "tags": ["resume", "full-stack"]},
    "contact": {"title": "Contact", "subtitle": "Open to internships, collaborations, and interesting projects.", "tags": ["contact", "consulting"]},
    "now": {"title": "Now", "subtitle": "What I'm focused on, building, and learning right now.", "tags": ["now"]},
    "uses": {"title": "Uses", "subtitle": "The hardware, software, and services I build with.", "tags": ["uses", "tools"]},
}


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls: list[dict] = []

    # Static pages
    for page in STATIC_PAGES:
        urls.append({"loc": f"{DOMAIN}{page}", "lastmod": now, "priority": "1.0" if page == "/" else "0.8"})

    # Dynamic case studies (live projects)
    proj_result = await db.execute(
        select(models.Project.project_id)
        .where(models.Project.status == "live")
        .order_by(models.Project.sort_order)
    )
    for (project_id,) in proj_result.all():
        urls.append({"loc": f"{DOMAIN}/projects/{project_id}", "lastmod": now, "priority": "0.7"})

    # Dynamic blog posts
    result = await db.execute(
        select(models.BlogPost.slug, models.BlogPost.updated_at)
        .where(models.BlogPost.published == True)  # noqa: E712
        .order_by(models.BlogPost.published_at.desc())
    )
    for row in result.all():
        slug, updated_at = row
        # updated_at is stored as ISO string; extract date portion
        lastmod = updated_at[:10] if updated_at else now
        urls.append({"loc": f"{DOMAIN}/blog/{slug}", "lastmod": lastmod, "priority": "0.6"})

    # Build XML
    xml_entries = []
    for u in urls:
        xml_entries.append(
            "  <url>\n"
            f"    <loc>{u['loc']}</loc>\n"
            f"    <lastmod>{u['lastmod']}</lastmod>\n"
            f"    <priority>{u['priority']}</priority>\n"
            "  </url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(xml_entries)
        + "\n</urlset>\n"
    )

    return Response(content=xml, media_type="application/xml")


@router.get("/resume.pdf", include_in_schema=False)
async def resume_pdf(variant: str = Query(""), db: AsyncSession = Depends(get_db)):
    from app.resume_pdf import generate_resume_pdf

    # Fetch all data
    about_row = (await db.execute(select(models.About).where(models.About.id == 1))).scalar_one_or_none()
    if not about_row:
        raise HTTPException(status_code=404, detail="About not found")

    exp_rows = (await db.execute(select(models.Experience).order_by(models.Experience.sort_order))).scalars().all()
    skill_rows = (await db.execute(select(models.Skill).order_by(models.Skill.sort_order))).scalars().all()
    proj_rows = (await db.execute(
        select(models.Project).where(models.Project.status == "live").order_by(models.Project.sort_order)
    )).scalars().all()
    cw_rows = (await db.execute(select(models.Coursework).order_by(models.Coursework.sort_order))).scalars().all()

    # Optional résumé flavor: overrides the summary and surfaces matching projects first.
    variant_dict = None
    if variant:
        vrow = (await db.execute(
            select(models.ResumeVariant).where(models.ResumeVariant.key == variant)
        )).scalar_one_or_none()
        if vrow:
            variant_dict = {"headline": vrow.headline, "summary": vrow.summary, "emphasis_tags": vrow.emphasis_tags or []}

    about = {"bio_paragraphs": about_row.bio_paragraphs, "gpa": about_row.gpa}
    experience = [{"title": e.title, "subtitle": e.subtitle, "year": e.year, "description": e.description} for e in exp_rows]
    skills = [{"name": s.name, "category": s.category} for s in skill_rows]
    projects = [{"title": p.title, "description": p.description, "tags": p.tags or [], "year": p.year, "link": p.link, "metrics": p.metrics or []} for p in proj_rows]
    coursework = [{"name": c.name} for c in cw_rows]

    # Surface projects whose tags match the variant emphasis (stable: matched first).
    if variant_dict and variant_dict["emphasis_tags"]:
        emphasis = {t.lower() for t in variant_dict["emphasis_tags"]}
        projects.sort(key=lambda p: 0 if {t.lower() for t in p["tags"]} & emphasis else 1)

    pdf_bytes = generate_resume_pdf(about, experience, skills, projects[:5], coursework, variant=variant_dict)

    suffix = f"_{variant}" if variant_dict else ""
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="NathanBlatter_Resume{suffix}.pdf"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
