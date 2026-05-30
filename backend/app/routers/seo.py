import io
import textwrap
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image, ImageDraw, ImageFont
import httpx

from app.database import get_db
from app import models

router = APIRouter(tags=["seo"])

DOMAIN = "https://nathanblatter.com"

STATIC_PAGES = [
    "/",
    "/about",
    "/projects",
    "/blog",
    "/resume",
    "/contact",
]

# ── OG Image cache ───────────────────────────────────────────────────────────
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


_credly_cache: dict[str, bytes] = {}

@router.get("/credly/badge/{badge_id}/image", include_in_schema=False)
async def credly_badge_image(badge_id: str):
    if badge_id in _credly_cache:
        return Response(content=_credly_cache[badge_id], media_type="image/png",
                        headers={"Cache-Control": "public, max-age=604800"})
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0, headers=headers) as client:
        # Fetch badge JSON to get the real CDN image URL
        meta = await client.get(f"https://www.credly.com/badges/{badge_id}.json")
        if meta.status_code != 200:
            raise HTTPException(status_code=502, detail="Badge metadata unavailable")
        image_url = meta.json()["data"]["badge_template"]["image_url"]
        img_r = await client.get(image_url)
    if img_r.status_code != 200:
        raise HTTPException(status_code=502, detail="Badge image unavailable")
    _credly_cache[badge_id] = img_r.content
    return Response(content=img_r.content, media_type=img_r.headers.get("content-type", "image/png"),
                    headers={"Cache-Control": "public, max-age=604800"})


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


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls: list[dict] = []

    # Static pages
    for page in STATIC_PAGES:
        urls.append({"loc": f"{DOMAIN}{page}", "lastmod": now, "priority": "1.0" if page == "/" else "0.8"})

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
async def resume_pdf(db: AsyncSession = Depends(get_db)):
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

    about = {"bio_paragraphs": about_row.bio_paragraphs, "gpa": about_row.gpa}
    experience = [{"title": e.title, "subtitle": e.subtitle, "year": e.year, "description": e.description} for e in exp_rows]
    skills = [{"name": s.name, "category": s.category} for s in skill_rows]
    projects = [{"title": p.title, "description": p.description, "tags": p.tags or [], "year": p.year, "link": p.link, "metrics": p.metrics or []} for p in proj_rows]
    coursework = [{"name": c.name} for c in cw_rows]

    pdf_bytes = generate_resume_pdf(about, experience, skills, projects[:5], coursework)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="NathanBlatter_Resume.pdf"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
