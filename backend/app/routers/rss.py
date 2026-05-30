from email.utils import format_datetime
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models

router = APIRouter(tags=["rss"])

DOMAIN = "https://nathanblatter.com"


def _rfc2822(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return format_datetime(dt)
    except Exception:
        return ""


@router.get("/feed.xml", include_in_schema=False)
async def rss_feed(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.BlogPost)
        .where(models.BlogPost.published == True)  # noqa: E712
        .order_by(models.BlogPost.published_at.desc())
        .limit(20)
    )
    posts = result.scalars().all()

    items = []
    for post in posts:
        desc = post.excerpt or post.subtitle or ""
        pub_date = f"<pubDate>{_rfc2822(post.published_at)}</pubDate>" if post.published_at else ""
        items.append(
            f"    <item>\n"
            f"      <title><![CDATA[{post.title}]]></title>\n"
            f"      <link>{DOMAIN}/blog/{post.slug}</link>\n"
            f"      <guid isPermaLink=\"true\">{DOMAIN}/blog/{post.slug}</guid>\n"
            f"      <description><![CDATA[{desc}]]></description>\n"
            f"      {pub_date}\n"
            f"    </item>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        "    <title>Nathan Blatter — Blog</title>\n"
        f"    <link>{DOMAIN}</link>\n"
        "    <description>Thoughts on software, technology, and things I'm learning.</description>\n"
        "    <language>en-us</language>\n"
        f'    <atom:link href="{DOMAIN}/feed.xml" rel="self" type="application/rss+xml"/>\n'
        + "\n".join(items)
        + "\n  </channel>\n</rss>"
    )

    return Response(content=xml, media_type="application/rss+xml; charset=utf-8")
