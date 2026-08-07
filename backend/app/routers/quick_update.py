"""Token-gated, login-less "quick update" forms delivered over iMessage.

Two low-friction self-service flows share one mechanism (see models.MagicLink):

  * ``monthly_update`` — on the 1st of each month Nathan gets a texted magic
    link to a form prefilled with the current /now and /uses content, so he can
    keep / replace / add entries and submit without the admin login.
  * ``availability`` — every Monday he gets a texted link to edit his recurring
    booking-availability windows for the week.

The token (``secrets.token_urlsafe``, 32+ bytes) is the only credential. Expiry
is enforced server-side; unknown/expired tokens 404 (no enumeration). Links are
reusable until expiry (low friction beats one-shot here — he may revisit).

Saves reuse the same storage + validation the admin endpoints use:
  * /now + /uses → the SiteContent JSON rows keyed "now"/"uses" (as PUT
    /site-content/{key} writes; those keys aren't aggregate-cached).
  * availability → the AvailabilityWindow rows + BookingSettings.enabled (as the
    /bookings/availability + /bookings/settings admin endpoints write).

The link is generated + texted by the generate endpoint (guarded by the
QUICK_UPDATE_TOKEN env var or an admin session) so a GitHub Actions cron only
needs a single curl. Failures are non-fatal.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas, imessage_service
from app.auth import require_auth
from app.cache import cache
from app.database import get_db
from app.utils import get_client_ip

log = logging.getLogger(__name__)

router = APIRouter(prefix="/quick-update", tags=["quick-update"])

SITE_URL = os.getenv("SITE_URL", "https://nathanblatter.com")

PURPOSES = {"monthly_update", "availability"}
DEFAULT_EXPIRY_DAYS = 7

# Light per-IP throttle on the public form endpoints (token is the real gate).
RL_MAX = int(os.getenv("QUICK_UPDATE_RL_MAX", "60"))
RL_WINDOW = int(os.getenv("QUICK_UPDATE_RL_WINDOW", "900"))  # 15 min


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


async def _throttle(request: Request) -> None:
    ip = get_client_ip(request)
    key = f"cache:rl:quick-update:{ip}"
    try:
        r = await cache._conn()
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, RL_WINDOW)
    except Exception:
        return  # fail open — never lock Nathan out because Redis is down
    if n > RL_MAX:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")


async def _resolve(token: str, db: AsyncSession) -> models.MagicLink:
    """Return a valid, unexpired link or 404 (no enumeration of token space)."""
    result = await db.execute(select(models.MagicLink).where(models.MagicLink.token == token))
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    exp = link.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < _now():
        raise HTTPException(status_code=404, detail="Link not found or expired")
    return link


async def _get_site_content(db: AsyncSession, key: str) -> dict:
    result = await db.execute(select(models.SiteContent).where(models.SiteContent.key == key))
    row = result.scalar_one_or_none()
    return dict(row.data) if row and isinstance(row.data, dict) else {}


async def _save_site_content(db: AsyncSession, key: str, data: dict) -> None:
    result = await db.execute(select(models.SiteContent).where(models.SiteContent.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        row = models.SiteContent(key=key)
        db.add(row)
    row.data = data
    row.updated_at = _now().isoformat()


# ── Public form endpoints (token-gated, no cookies) ──────────────────────────

@router.get("/{token}", response_model=schemas.QuickUpdateContext)
async def get_context(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_throttle),
):
    """Return the form's purpose + current content to prefill the fields."""
    link = await _resolve(token, db)
    ctx = schemas.QuickUpdateContext(purpose=link.purpose, expires_at=_iso(link.expires_at))

    if link.purpose == "monthly_update":
        ctx.now = await _get_site_content(db, "now")
        ctx.uses = await _get_site_content(db, "uses")
    elif link.purpose == "availability":
        settings_result = await db.execute(
            select(models.BookingSettings).where(models.BookingSettings.id == 1)
        )
        settings = settings_result.scalar_one_or_none()
        ctx.timezone = settings.timezone if settings else "America/Denver"
        ctx.booking_enabled = settings.enabled if settings else True
        win_result = await db.execute(
            select(models.AvailabilityWindow).order_by(
                models.AvailabilityWindow.day_of_week, models.AvailabilityWindow.start_time
            )
        )
        ctx.windows = [
            schemas.QuickUpdateAvailabilityWindow(
                day_of_week=w.day_of_week,
                start_time=w.start_time,
                end_time=w.end_time,
                allowed_durations=list(w.allowed_durations or [30]),
                enabled=w.enabled,
            )
            for w in win_result.scalars().all()
        ]
        today = datetime.now(ZoneInfo(ctx.timezone)).date()
        ov_result = await db.execute(
            select(models.AvailabilityDateWindow)
            .where(
                models.AvailabilityDateWindow.date >= today,
                models.AvailabilityDateWindow.date < today + timedelta(days=7),
            )
            .order_by(models.AvailabilityDateWindow.date, models.AvailabilityDateWindow.start_time)
        )
        ctx.week_overrides = [
            schemas.QuickUpdateWeekOverride(
                date=o.date.isoformat(),
                start_time=o.start_time,
                end_time=o.end_time,
                allowed_durations=list(o.allowed_durations or [30]),
                closed=o.closed,
            )
            for o in ov_result.scalars().all()
        ]
    return ctx


@router.post("/{token}/save")
async def save(
    token: str,
    payload: schemas.QuickUpdateSave,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_throttle),
):
    """Persist the submitted content, reusing the admin save paths + caches."""
    link = await _resolve(token, db)

    if link.purpose == "monthly_update":
        if payload.now is not None:
            await _save_site_content(db, "now", payload.now)
        if payload.uses is not None:
            await _save_site_content(db, "uses", payload.uses)
        # /now + /uses read /site-content/{key} directly (no aggregate cache),
        # but keep parity with the admin write path in case one is added later.
        await cache.delete("page:now")
        await cache.delete("page:uses")

    elif link.purpose == "availability":
        if payload.windows is not None and payload.scope == "week":
            _validate_windows(payload.windows)
            # "Just this week": write dated one-off windows for the next 7
            # days and leave the standing schedule untouched. Every date in
            # the range becomes explicit — a weekday with no submitted window
            # gets a closed marker so it yields no slots this week even if
            # the recurring schedule normally opens it.
            settings_result = await db.execute(
                select(models.BookingSettings).where(models.BookingSettings.id == 1)
            )
            settings = settings_result.scalar_one_or_none()
            tz = ZoneInfo(settings.timezone if settings else "America/Denver")
            today = datetime.now(tz).date()
            week_dates = [today + timedelta(days=i) for i in range(7)]
            # Replace this week's overrides; also self-prune stale past rows.
            stale = await db.execute(
                select(models.AvailabilityDateWindow).where(
                    models.AvailabilityDateWindow.date < today + timedelta(days=7)
                )
            )
            for row in stale.scalars().all():
                await db.delete(row)
            by_dow = {}
            for w in payload.windows:
                if w.enabled:
                    by_dow.setdefault(w.day_of_week, []).append(w)
            for d in week_dates:
                wins = by_dow.get(d.weekday(), [])
                if wins:
                    for w in wins:
                        db.add(models.AvailabilityDateWindow(
                            date=d,
                            start_time=w.start_time,
                            end_time=w.end_time,
                            allowed_durations=w.allowed_durations or [30],
                        ))
                else:
                    db.add(models.AvailabilityDateWindow(date=d, closed=True))
        elif payload.windows is not None:
            _validate_windows(payload.windows)
            # Replace-all: the weekly form shows the full recurring set and lets
            # him edit it wholesale, mirroring the admin availability CRUD result.
            existing = await db.execute(select(models.AvailabilityWindow))
            for w in existing.scalars().all():
                await db.delete(w)
            for w in payload.windows:
                db.add(models.AvailabilityWindow(
                    day_of_week=w.day_of_week,
                    start_time=w.start_time,
                    end_time=w.end_time,
                    allowed_durations=w.allowed_durations or [30],
                    enabled=w.enabled,
                ))
        if payload.booking_enabled is not None:
            settings_result = await db.execute(
                select(models.BookingSettings).where(models.BookingSettings.id == 1)
            )
            settings = settings_result.scalar_one_or_none()
            if settings is None:
                settings = models.BookingSettings(id=1)
                db.add(settings)
            settings.enabled = payload.booking_enabled

    if link.used_at is None:
        link.used_at = _now()
    await db.commit()
    return {"ok": True}


def _validate_windows(windows: list[schemas.QuickUpdateAvailabilityWindow]) -> None:
    for w in windows:
        try:
            sh, sm = map(int, w.start_time.split(":"))
            eh, em = map(int, w.end_time.split(":"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid time format: {w.start_time}/{w.end_time}")
        if not (0 <= sh < 24 and 0 <= sm < 60 and 0 <= eh <= 24 and 0 <= em < 60):
            raise HTTPException(status_code=400, detail="Time out of range")
        if (eh * 60 + em) <= (sh * 60 + sm):
            raise HTTPException(status_code=400, detail="End time must be after start time")
        if not w.allowed_durations or any(d not in (15, 30) for d in w.allowed_durations):
            raise HTTPException(status_code=400, detail="Durations must be 15 or 30 minutes")


# ── Generation endpoint (env-token OR admin session) ─────────────────────────

def _generate_authorized(request: Request, x_quick_update_token: str) -> bool:
    """True if the caller presented the shared generate token; else fall back to
    the admin cookie auth (require_auth) below."""
    expected = (os.getenv("QUICK_UPDATE_TOKEN") or "").strip()
    return bool(expected) and secrets.compare_digest(x_quick_update_token.strip(), expected)


@router.post("/generate", response_model=schemas.QuickUpdateGenerateResponse)
async def generate(
    payload: schemas.QuickUpdateGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_quick_update_token: str = Header(default=""),
):
    """Mint a magic link (and optionally text it). Guarded by the
    QUICK_UPDATE_TOKEN env var (for the cron) or a logged-in admin session."""
    if not _generate_authorized(request, x_quick_update_token):
        # Fall back to admin cookie auth; raises 401 if neither is present.
        require_auth(request.cookies.get("auth_token"))

    if payload.purpose not in PURPOSES:
        raise HTTPException(status_code=400, detail="Unknown purpose")

    days = payload.expires_days or DEFAULT_EXPIRY_DAYS
    token = secrets.token_urlsafe(32)
    now = _now()
    link = models.MagicLink(
        token=token,
        purpose=payload.purpose,
        expires_at=now + timedelta(days=days),
        created_at=now,
    )
    db.add(link)
    await db.commit()

    url = f"{SITE_URL.rstrip('/')}/quick-update/{token}"

    sent = False
    if payload.send:
        if payload.purpose == "monthly_update":
            msg = f"Monthly refresh: update your /now + /uses.\nOpen: {url}\n(Link works for {days} days.)"
        else:
            msg = f"Weekly refresh: set your booking availability.\nOpen: {url}\n(Link works for {days} days.)"
        try:
            await imessage_service.send_alert(msg)
            sent = True
        except Exception:
            log.warning("quick-update iMessage send failed (non-fatal)")

    return schemas.QuickUpdateGenerateResponse(
        token=token, purpose=payload.purpose, url=url,
        expires_at=_iso(link.expires_at), sent=sent,
    )
