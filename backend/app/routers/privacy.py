"""Privacy policy — assembled from a template + a live "data practices inventory".

The policy is not a hand-written static page. Each render:
  * derives the enumerated data practices from what the site actually does
    (analytics proxy, cookie/local-storage keys, contact form, bookings/Zoom,
    newsletter, bug reports, tracked links, third-party services). Sections that
    depend on a feature only appear when that feature is configured, so the
    policy tracks reality as the site changes.
  * stamps a "Last updated: <Month Year>" effective date from the current date,
    so it reads as current without manual edits. A monthly GitHub Actions cron
    (POST /privacy/refresh) busts the cache on the 1st so the date flips
    immediately; even without the cron the short TTL self-heals within the hour.

Admin overrides live in the SiteContent row keyed "privacy" (optional): keys
`owner`, `site`, `contact_url`, `overview` override the defaults, and
`extra_sections` (a list of {id, heading, paragraphs?, bullets?}) is appended.
Edited via the existing PUT /site-content/privacy, which busts this cache.
"""

import os
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app import models
from app.cache import cache

router = APIRouter(prefix="/privacy", tags=["privacy"])

CACHE_KEY = "page:privacy"
CACHE_TTL = 900  # 15 min; also busted by the monthly cron and by admin edits

DEFAULT_OWNER = "Nathan Blatter"
DEFAULT_SITE = "nathanblatter.com"
DEFAULT_CONTACT_URL = "/contact"


def _effective_date() -> str:
    return datetime.now().strftime("%B %Y")


def _flag(*names: str) -> bool:
    """True if any of the named env vars is set to a non-empty value."""
    return any((os.getenv(n) or "").strip() for n in names)


def _build_sections() -> list[dict]:
    """The live data-practices inventory. Feature-gated so the policy only
    claims what the deployed configuration actually does."""
    sections: list[dict] = []

    # --- Analytics (Umami proxy) ---
    if _flag("UMAMI_WEBSITE_ID", "UMAMI_URL", "UMAMI_BASE_URL"):
        sections.append({
            "id": "analytics",
            "heading": "Analytics",
            "paragraphs": [
                "This site uses Umami Analytics, a privacy-focused, open-source "
                "analytics platform self-hosted on personal infrastructure and "
                "served first-party through this domain. Umami does not use "
                "cookies, does not collect personally identifiable information, "
                "and does not track you across websites.",
                "Each page view records only:",
            ],
            "bullets": [
                "Page URL and referrer",
                "Browser type and operating system (generic)",
                "Screen size category",
                "Country (derived from IP, which is not stored)",
            ],
            "footnote": "This data is used solely to understand which content is "
                        "useful. It is never sold or shared with third parties.",
        })

    # --- Cookies & local storage (cookie banner + theme + admin auth) ---
    sections.append({
        "id": "cookies",
        "heading": "Cookies & Local Storage",
        "paragraphs": ["This site sets no tracking cookies. The following is "
                       "stored locally in your browser:"],
        "table": {
            "columns": ["Key", "Type", "Purpose"],
            "rows": [
                ["theme", "localStorage", "Remembers your light/dark mode preference"],
                ["cookie-consent", "localStorage", "Records that you dismissed the cookie notice"],
                ["auth_token", "httpOnly cookie", "Admin session only — set solely if you log into the admin panel. Not accessible to JavaScript. Never set for regular visitors."],
            ],
        },
    })

    # --- Contact form ---
    sections.append({
        "id": "contact-form",
        "heading": "Contact Form",
        "paragraphs": [
            "If you submit a message via the contact form, your name, email "
            "address, and message are emailed to the site owner and stored "
            "privately so your inquiry can be tracked and answered. This data is "
            "used only to correspond with you. It is never sold or shared, and "
            "you can request its deletion at any time (see below).",
        ],
    })

    # --- Booking a call ---
    zoom = _flag("ZOOM_CLIENT_ID", "ZOOM_ACCOUNT_ID")
    booking_paras = [
        "If you request a call through the booking page, the name, email "
        "address, and topic you provide are stored so the meeting can be "
        "scheduled and managed. Confirmation, reminder, and update emails are "
        "sent to that address.",
    ]
    if zoom:
        booking_paras.append(
            "To host the call, a meeting link is created through Zoom; the "
            "details you submit are shared with Zoom only as needed to set up "
            "that meeting."
        )
    booking_paras.append(
        "This data is never sold or shared with anyone else, and you can request "
        "its deletion at any time (see below)."
    )
    sections.append({
        "id": "bookings",
        "heading": "Scheduling a Call",
        "paragraphs": booking_paras,
    })

    # --- Newsletter ---
    sections.append({
        "id": "newsletter",
        "heading": "Newsletter",
        "paragraphs": [
            "If you subscribe to the newsletter, your email address is stored so "
            "new posts and updates can be sent to you. It is never sold or shared, "
            "and every email includes an unsubscribe option; you can also request "
            "removal at any time (see below).",
        ],
    })

    # --- Bug reports / feedback (only when the tracker is configured) ---
    if _flag("FLIGHTDECK_INGEST_KEY"):
        sections.append({
            "id": "bug-reports",
            "heading": "Bug Reports & Feedback",
            "paragraphs": [
                "If you use the feedback widget to report a problem, the message "
                "you write — along with the page you were on and basic technical "
                "details (browser user-agent and viewport size) — is forwarded to "
                "a private issue tracker so the problem can be fixed. Only include "
                "personal information if you choose to. This data is used solely to "
                "diagnose and resolve issues and is never sold or shared.",
            ],
        })

    # --- Tracked links ---
    sections.append({
        "id": "tracked-links",
        "heading": "Outbound Link Counts",
        "paragraphs": [
            "Some outbound links on this site redirect through a counter that "
            "records an aggregate click tally per link. This measures which links "
            "are useful; it does not build a profile of you or store personal "
            "identifiers.",
        ],
    })

    # --- Public visualizations (owner's own data, not visitors') ---
    sections.append({
        "id": "public-data",
        "heading": "Public Visualizations",
        "paragraphs": [
            "Parts of this site display the owner's own data (such as public "
            "GitHub activity and Claude usage summaries). This is the owner's "
            "information shown for interest — no visitor data is collected to "
            "produce these views.",
        ],
    })

    # --- Third-party services ---
    third_parties = [
        {"name": "Google Fonts", "url": "https://policies.google.com/privacy",
         "note": "This site loads fonts from Google's CDN. When your browser fetches these fonts, Google may log your IP address."},
        {"name": "Cloudflare", "url": "https://www.cloudflare.com/privacypolicy/",
         "note": "This site is served through Cloudflare's network, which may process request metadata (IP address, headers) for security and performance."},
    ]
    if zoom:
        third_parties.append(
            {"name": "Zoom", "url": "https://www.zoom.com/en/trust/privacy/",
             "note": "If you book a call, a meeting is created through Zoom. The name, email, and topic you provide are shared with Zoom solely to set up and host that meeting."}
        )
    sections.append({
        "id": "third-parties",
        "heading": "Third-Party Services",
        "links": third_parties,
    })

    # --- Rights ---
    sections.append({
        "id": "rights",
        "heading": "Your Rights (GDPR)",
        "paragraphs": [
            "If you are located in the European Economic Area, you have the right "
            "to access, correct, or request deletion of any personal data held "
            "about you. Browsing the site creates no persistent personal record. "
            "If you have contacted the site owner, booked a call, subscribed to "
            "the newsletter, or submitted feedback, you can request a copy or "
            "deletion of that information at any time by getting in touch.",
        ],
    })

    return sections


async def _assemble(db: AsyncSession) -> dict:
    overrides: dict = {}
    try:
        row = await db.execute(
            select(models.SiteContent).where(models.SiteContent.key == "privacy")
        )
        rec = row.scalar_one_or_none()
        if rec and isinstance(rec.data, dict):
            overrides = rec.data
    except Exception:
        overrides = {}

    owner = overrides.get("owner") or DEFAULT_OWNER
    site = overrides.get("site") or DEFAULT_SITE
    overview = overrides.get("overview") or (
        f"This is the personal portfolio of {owner} ({site}). This policy "
        "explains what data is collected when you visit, how it is used, and "
        "your rights. The short version: very little is collected, nothing is "
        "sold, and you are never tracked across sites."
    )

    sections = _build_sections()
    extra = overrides.get("extra_sections")
    if isinstance(extra, list):
        for s in extra:
            if isinstance(s, dict) and s.get("heading"):
                sections.append(s)

    return {
        "title": "Privacy Policy",
        "effective_date": _effective_date(),
        "owner": owner,
        "site": site,
        "contact_url": overrides.get("contact_url") or DEFAULT_CONTACT_URL,
        "overview": overview,
        "sections": sections,
    }


@router.get("")
async def get_privacy(db: AsyncSession = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached is not None:
        return cached
    data = await _assemble(db)
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return data


@router.post("/refresh")
async def refresh_privacy(
    x_refresh_token: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Bust the cache so the policy re-renders (new month / changed features).

    Called by the monthly GitHub Actions cron. Token-protected via the
    PRIVACY_REFRESH_TOKEN env var. Failure-tolerant: cache ops never raise.
    """
    token = (os.getenv("PRIVACY_REFRESH_TOKEN") or "").strip()
    if not token or not secrets.compare_digest((x_refresh_token or "").strip(), token):
        raise HTTPException(status_code=403, detail="Invalid or missing refresh token.")
    await cache.delete(CACHE_KEY)
    data = await _assemble(db)
    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
    return {"ok": True, "effective_date": data["effective_date"]}
