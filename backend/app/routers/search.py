"""Public site-wide search across blog posts, projects, and key pages.

Small-site scale: candidates are loaded and ranked in Python (no full-text infra).
Title hits rank above tag/body hits; results are capped.
"""
import re
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models

router = APIRouter(prefix="/search", tags=["search"])

# Static pages aren't in the DB; give them searchable keywords.
_STATIC_PAGES = [
    {"title": "About", "url": "/about", "keywords": "about bio background education experience"},
    {"title": "Projects", "url": "/projects", "keywords": "projects work portfolio case studies"},
    {"title": "Blog", "url": "/blog", "keywords": "blog writing articles posts technical"},
    {"title": "Résumé", "url": "/resume", "keywords": "resume cv experience download pdf"},
    {"title": "Contact", "url": "/contact", "keywords": "contact email hire booking call"},
    {"title": "Now", "url": "/now", "keywords": "now current focus building learning"},
    {"title": "Uses", "url": "/uses", "keywords": "uses tools setup gear hardware software"},
]


def _clean(text: str | None, limit: int = 130) -> str:
    if not text:
        return ""
    flat = re.sub(r"[#*_`>~\[\]()]", " ", text)
    flat = re.sub(r"\s+", " ", flat).strip()
    return flat[:limit].rstrip() + ("…" if len(flat) > limit else "")


def _score(query: str, title: str, haystack: str) -> int:
    """Rank: title prefix/substring > all words present > some words present."""
    t = title.lower()
    if query in t:
        return 100 - min(t.index(query), 40)
    words = [w for w in query.split() if w]
    if words and all(w in haystack for w in words):
        return 45
    hits = sum(1 for w in words if w in haystack)
    return hits * 10


@router.get("")
async def search(q: str = Query("", max_length=120), db: AsyncSession = Depends(get_db)):
    query = q.strip().lower()
    if len(query) < 2:
        return {"results": []}

    results: list[dict] = []

    posts = (await db.execute(
        select(models.BlogPost).where(models.BlogPost.published == True)  # noqa: E712
    )).scalars().all()
    for p in posts:
        hay = " ".join(filter(None, [p.title, p.subtitle, p.excerpt, " ".join(p.tags or [])])).lower()
        score = _score(query, p.title or "", hay)
        if score:
            results.append({
                "type": "blog", "title": p.title,
                "subtitle": _clean(p.subtitle or p.excerpt),
                "url": f"/blog/{p.slug}", "tags": (p.tags or [])[:3], "_score": score,
            })

    projects = (await db.execute(select(models.Project))).scalars().all()
    for pr in projects:
        hay = " ".join(filter(None, [pr.title, pr.description, " ".join(pr.tags or [])])).lower()
        score = _score(query, pr.title or "", hay)
        if score:
            results.append({
                "type": "project", "title": pr.title,
                "subtitle": _clean(pr.description),
                "url": f"/projects/{pr.project_id}", "tags": (pr.tags or [])[:3], "_score": score,
            })

    for pg in _STATIC_PAGES:
        hay = f"{pg['title']} {pg['keywords']}".lower()
        score = _score(query, pg["title"], hay)
        if score:
            results.append({
                "type": "page", "title": pg["title"], "subtitle": "",
                "url": pg["url"], "tags": [], "_score": score,
            })

    results.sort(key=lambda r: r["_score"], reverse=True)
    return {"results": [{k: v for k, v in r.items() if k != "_score"} for r in results[:20]]}
