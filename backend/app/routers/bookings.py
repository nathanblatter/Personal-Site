import logging
import os
from datetime import date, datetime, timedelta, time as dt_time
from html import escape
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas, crm_utils
from app.auth import require_auth, create_action_token, verify_action_token
from app.database import get_db
from app.email_service import (
    send_booking_request_email,
    send_booking_confirmed_email,
    send_booking_declined_email,
    send_booking_cancelled_email,
    send_booking_received_email,
    send_booking_reminder_email,
    _fmt_time,
)
from app.zoom_service import create_meeting, delete_meeting
from app.utils import get_client_ip, get_redis
from app import imessage_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])

SITE_URL = os.getenv("SITE_URL", "https://nathanblatter.com")


async def _send_booking_imessage(booking, admin_tz: str = "America/Denver"):
    """Send an iMessage alert for a new booking request."""
    time_str = _fmt_time(booking.start_at, admin_tz)
    accept_url = f"{SITE_URL}/api/v1/bookings/action?token={create_action_token('accept', booking.id)}"
    decline_url = f"{SITE_URL}/api/v1/bookings/action?token={create_action_token('decline', booking.id)}"
    msg = (
        f"New booking request!\n"
        f"{booking.visitor_name} ({booking.visitor_email})\n"
        f"Topic: {booking.topic}\n"
        f"Time: {time_str} ({booking.duration_minutes} min)\n\n"
        f"Accept: {accept_url}\n"
        f"Decline: {decline_url}"
    )
    await imessage_service.send_alert(msg)


SETTINGS_ID = 1


async def _get_settings(db: AsyncSession) -> models.BookingSettings:
    result = await db.execute(
        select(models.BookingSettings).where(models.BookingSettings.id == SETTINGS_ID)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = models.BookingSettings(id=SETTINGS_ID)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


def _action_result_html(title: str, message: str, success: bool = True) -> HTMLResponse:
    title = escape(title)
    message = escape(message)
    color = "#10b981" if success else "#ef4444"
    icon = "&#10003;" if success else "&#10007;"
    return HTMLResponse(f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:400px;text-align:center;padding:40px;">
<div style="width:64px;height:64px;border-radius:50%;background:{color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:{color};">{icon}</div>
<h1 style="font-size:24px;color:#1a1f2e;margin:0 0 8px;">{title}</h1>
<p style="color:#64748b;font-size:15px;line-height:1.6;">{message}</p>
</div></body></html>""")


# ── Public endpoints ─────────────────────────────────────────────────────────

@router.get("/settings/public", response_model=schemas.BookingSettingsResponse)
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    settings = await _get_settings(db)
    # Fetch which weekdays have enabled availability windows
    result = await db.execute(
        select(models.AvailabilityWindow.day_of_week).where(
            models.AvailabilityWindow.enabled == True
        ).distinct()
    )
    available_days = [row[0] for row in result.all()]
    return schemas.BookingSettingsResponse(
        timezone=settings.timezone,
        enabled=settings.enabled,
        available_days=sorted(available_days),
    )


@router.get("/slots", response_model=list[schemas.AvailableSlot])
async def get_available_slots(date: date, db: AsyncSession = Depends(get_db)):
    settings = await _get_settings(db)
    if not settings.enabled:
        return []

    tz = ZoneInfo(settings.timezone)

    # Check date override (blocked)
    override = await db.execute(
        select(models.DateOverride).where(models.DateOverride.date == date)
    )
    if override.scalar_one_or_none():
        return []

    # Only allow next 14 days
    today = datetime.now(tz).date()
    if date < today or date > today + timedelta(days=14):
        return []

    # Dated one-off windows replace the recurring weekday schedule for this
    # date only (personal-site-54); a closed marker row yields no slots.
    date_windows_result = await db.execute(
        select(models.AvailabilityDateWindow).where(models.AvailabilityDateWindow.date == date)
    )
    date_windows = date_windows_result.scalars().all()
    if date_windows:
        windows = [w for w in date_windows if not w.closed]
    else:
        # Get availability windows for this weekday
        day_of_week = date.weekday()  # 0=Mon
        windows_result = await db.execute(
            select(models.AvailabilityWindow).where(
                and_(
                    models.AvailabilityWindow.day_of_week == day_of_week,
                    models.AvailabilityWindow.enabled == True,
                )
            )
        )
        windows = windows_result.scalars().all()
    if not windows:
        return []

    # Get existing bookings for this date (pending + confirmed)
    day_start_utc = datetime.combine(date, dt_time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    day_end_utc = datetime.combine(date + timedelta(days=1), dt_time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))

    bookings_result = await db.execute(
        select(models.Booking).where(
            and_(
                models.Booking.start_at >= day_start_utc,
                models.Booking.start_at < day_end_utc,
                models.Booking.status.in_(["pending", "confirmed"]),
            )
        )
    )
    existing_bookings = bookings_result.scalars().all()

    # Build booked intervals (with buffer: 15 min after a 15-min call, 30 min after a 30+ min call)
    booked_intervals = []
    for b in existing_bookings:
        b_start = b.start_at
        buffer = 15 if b.duration_minutes <= 15 else 30
        b_end = b_start + timedelta(minutes=b.duration_minutes + buffer)
        booked_intervals.append((b_start, b_end))

    slots: list[schemas.AvailableSlot] = []

    for window in windows:
        w_start_h, w_start_m = map(int, window.start_time.split(":"))
        w_end_h, w_end_m = map(int, window.end_time.split(":"))

        w_start = datetime.combine(date, dt_time(w_start_h, w_start_m), tzinfo=tz)
        w_end = datetime.combine(date, dt_time(w_end_h, w_end_m), tzinfo=tz)

        min_duration = min(window.allowed_durations)
        current = w_start

        while current + timedelta(minutes=min_duration) <= w_end:
            current_utc = current.astimezone(ZoneInfo("UTC"))
            available_durations = []

            for dur in sorted(window.allowed_durations):
                slot_end_utc = current_utc + timedelta(minutes=dur)
                # Check if this slot fits in the window
                if current + timedelta(minutes=dur) > w_end:
                    continue
                # Check overlap with existing bookings
                overlaps = False
                for b_start, b_end in booked_intervals:
                    if current_utc < b_end and slot_end_utc > b_start:
                        overlaps = True
                        break
                if not overlaps:
                    available_durations.append(dur)

            if available_durations:
                slot_end_utc = current_utc + timedelta(minutes=max(available_durations))
                slots.append(schemas.AvailableSlot(
                    start=current_utc.isoformat(),
                    end=slot_end_utc.isoformat(),
                    durations=available_durations,
                ))

            current += timedelta(minutes=min_duration)

    # Filter out slots in the past
    now_utc = datetime.now(ZoneInfo("UTC"))
    slots = [s for s in slots if datetime.fromisoformat(s.start) > now_utc]

    return slots


@router.post("", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(payload: schemas.BookingCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # Honeypot
    if payload.honeypot:
        # Return fake success
        return schemas.BookingResponse(
            id=0, visitor_name=payload.visitor_name, visitor_email=payload.visitor_email,
            topic=payload.topic, start_at=datetime.now(), duration_minutes=payload.duration_minutes,
            status="pending", created_at=datetime.now(),
        )

    settings = await _get_settings(db)
    if not settings.enabled:
        raise HTTPException(status_code=400, detail="Booking is currently disabled")

    # Rate limiting
    redis = get_redis()
    ip = get_client_ip(request)
    ip_key = f"booking:ip:{ip}"
    ip_count = await redis.incr(ip_key)
    if ip_count == 1:
        await redis.expire(ip_key, 900)  # 15 min window
    if ip_count > 3:
        raise HTTPException(status_code=429, detail="Too many booking requests. Try again later.")

    daily_key = f"booking:daily:{date.today().isoformat()}"
    daily_count = await redis.incr(daily_key)
    if daily_count == 1:
        await redis.expire(daily_key, 86400)
    if daily_count > 20:
        raise HTTPException(status_code=429, detail="Daily booking limit reached.")

    # Validate duration
    if payload.duration_minutes not in (15, 30):
        raise HTTPException(status_code=400, detail="Duration must be 15 or 30 minutes")

    # Parse start_at
    try:
        start_at = datetime.fromisoformat(payload.start_at)
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=ZoneInfo("UTC"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_at datetime")

    # Verify slot is actually available
    slot_date = start_at.astimezone(ZoneInfo(settings.timezone)).date()
    available = await get_available_slots(slot_date, db)
    slot_valid = False
    for slot in available:
        if datetime.fromisoformat(slot.start) == start_at and payload.duration_minutes in slot.durations:
            slot_valid = True
            break

    if not slot_valid:
        raise HTTPException(status_code=400, detail="Selected time slot is not available")

    # Link/create a CRM contact (de-duplicated by email) for this visitor.
    contact = await crm_utils.upsert_contact_by_email(
        db, email=payload.visitor_email, name=payload.visitor_name,
        source=models.ContactSource.booking,
    )

    booking = models.Booking(
        contact_id=contact.id,
        visitor_name=payload.visitor_name,
        visitor_email=payload.visitor_email,
        topic=payload.topic,
        start_at=start_at,
        duration_minutes=payload.duration_minutes,
        status=models.BookingStatus.pending,
        created_at=datetime.now(ZoneInfo("UTC")),
    )
    db.add(booking)
    await crm_utils.log_activity(
        db, contact_id=contact.id, type=models.ActivityType.booking,
        body_md=f"Booked a call: **{payload.topic}**", occurred_at=start_at,
    )
    await db.commit()
    await db.refresh(booking)

    # Send notifications (fire and forget)
    try:
        accept_token = create_action_token("accept", booking.id)
        decline_token = create_action_token("decline", booking.id)
        await send_booking_request_email(booking, settings.timezone, accept_token, decline_token)
    except Exception:
        pass
    try:
        await send_booking_received_email(booking)
    except Exception:
        pass
    try:
        await _send_booking_imessage(booking, settings.timezone)
    except Exception:
        pass

    return booking


# ── Public action endpoint (magic link from email/text) ──────────────────────

@router.get("/action", response_class=HTMLResponse)
async def handle_action(token: str, db: AsyncSession = Depends(get_db)):
    """Accept/decline/cancel a booking via a magic link token."""
    payload = verify_action_token(token)
    action = payload.get("action")
    booking_id = payload.get("booking_id")

    result = await db.execute(
        select(models.Booking).where(models.Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        return _action_result_html("Not Found", "This booking no longer exists.", False)

    settings = await _get_settings(db)

    if action == "accept":
        if booking.status != models.BookingStatus.pending:
            return _action_result_html("Already Handled", f"This booking has already been {booking.status.value}.")

        # Create Zoom meeting
        try:
            zoom = await create_meeting(
                topic=f"Call with Nathan and {booking.visitor_name}",
                start_at=booking.start_at,
                duration_minutes=booking.duration_minutes,
            )
            if zoom:
                booking.zoom_join_url = zoom["join_url"]
                booking.zoom_meeting_id = zoom["meeting_id"]
        except Exception as e:
            log.warning("Zoom meeting creation failed: %s", e)

        booking.status = models.BookingStatus.confirmed
        booking.decided_at = datetime.now(ZoneInfo("UTC"))
        await db.commit()
        await db.refresh(booking)

        try:
            cancel_token = create_action_token("cancel", booking.id, hours=168)
            await send_booking_confirmed_email(booking, settings.timezone, cancel_token)
        except Exception:
            pass

        return _action_result_html(
            "Booking Accepted",
            f"Call with {booking.visitor_name} confirmed. Zoom meeting created and invites sent."
        )

    elif action == "decline":
        if booking.status != models.BookingStatus.pending:
            return _action_result_html("Already Handled", f"This booking has already been {booking.status.value}.")

        booking.status = models.BookingStatus.declined
        booking.decided_at = datetime.now(ZoneInfo("UTC"))
        await db.commit()
        await db.refresh(booking)

        try:
            await send_booking_declined_email(booking)
        except Exception:
            pass

        return _action_result_html(
            "Booking Declined",
            f"Booking from {booking.visitor_name} has been declined. They've been notified."
        )

    elif action == "cancel":
        if booking.status == models.BookingStatus.cancelled:
            return _action_result_html("Already Cancelled", "This booking has already been cancelled.")
        if booking.status not in (models.BookingStatus.pending, models.BookingStatus.confirmed):
            return _action_result_html("Cannot Cancel", f"This booking has been {booking.status.value} and cannot be cancelled.", False)

        was_confirmed = booking.status == models.BookingStatus.confirmed

        # Delete Zoom meeting if exists
        if booking.zoom_meeting_id:
            try:
                await delete_meeting(booking.zoom_meeting_id)
            except Exception:
                pass

        booking.status = models.BookingStatus.cancelled
        booking.decided_at = datetime.now(ZoneInfo("UTC"))
        await db.commit()
        await db.refresh(booking)

        try:
            await send_booking_cancelled_email(booking, settings.timezone, cancelled_by_visitor=True)
        except Exception:
            pass

        msg = "Your booking has been cancelled."
        if was_confirmed:
            msg += " The Zoom meeting has been removed."
        msg += f' <a href="{SITE_URL}/contact" style="color:#3b6cf5;text-decoration:underline;">Reschedule a call</a>'
        return _action_result_html("Booking Cancelled", msg)

    return _action_result_html("Invalid Action", "Unknown action.", False)


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=list[schemas.BookingResponse])
async def list_bookings(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    query = select(models.Booking).order_by(models.Booking.created_at.desc())
    if status:
        query = query.where(models.Booking.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/admin-create", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_booking(
    payload: schemas.AdminBookingCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Admin creates a confirmed booking directly, bypassing availability checks."""
    settings = await _get_settings(db)

    try:
        start_at = datetime.fromisoformat(payload.start_at)
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=ZoneInfo("UTC"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_at datetime")

    contact = await crm_utils.upsert_contact_by_email(
        db, email=payload.visitor_email, name=payload.visitor_name,
        source=models.ContactSource.booking,
    )

    booking = models.Booking(
        contact_id=contact.id,
        visitor_name=payload.visitor_name,
        visitor_email=payload.visitor_email,
        topic=payload.topic,
        start_at=start_at,
        duration_minutes=payload.duration_minutes,
        status=models.BookingStatus.confirmed,
        created_at=datetime.now(ZoneInfo("UTC")),
        decided_at=datetime.now(ZoneInfo("UTC")),
    )

    # Create Zoom meeting
    try:
        zoom = await create_meeting(
            topic=f"Call with Nathan and {payload.visitor_name}",
            start_at=start_at,
            duration_minutes=payload.duration_minutes,
        )
        if zoom:
            booking.zoom_join_url = zoom["join_url"]
            booking.zoom_meeting_id = zoom["meeting_id"]
    except Exception as e:
        log.warning("Zoom meeting creation failed: %s", e)

    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Send confirmation email with cancel token
    try:
        cancel_token = create_action_token("cancel", booking.id, hours=168)
        await send_booking_confirmed_email(booking, settings.timezone, cancel_token)
    except Exception:
        pass

    return booking


@router.put("/{booking_id}/accept", response_model=schemas.BookingResponse)
async def accept_booking(
    booking_id: int,
    payload: schemas.BookingDecision | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.Booking).where(models.Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != models.BookingStatus.pending:
        raise HTTPException(status_code=400, detail="Booking is not pending")

    settings = await _get_settings(db)

    # Create Zoom meeting
    try:
        zoom = await create_meeting(
            topic=f"Call with Nathan and {booking.visitor_name}",
            start_at=booking.start_at,
            duration_minutes=booking.duration_minutes,
        )
        if zoom:
            booking.zoom_join_url = zoom["join_url"]
            booking.zoom_meeting_id = zoom["meeting_id"]
    except Exception as e:
        log.warning("Zoom meeting creation failed: %s", e)

    booking.status = models.BookingStatus.confirmed
    booking.decided_at = datetime.now(ZoneInfo("UTC"))
    if payload and payload.admin_note:
        booking.admin_note = payload.admin_note

    await db.commit()
    await db.refresh(booking)

    # Send confirmation emails with cancel token for visitor
    try:
        cancel_token = create_action_token("cancel", booking.id, hours=168)
        await send_booking_confirmed_email(booking, settings.timezone, cancel_token)
    except Exception:
        pass

    return booking


@router.put("/{booking_id}/decline", response_model=schemas.BookingResponse)
async def decline_booking(
    booking_id: int,
    payload: schemas.BookingDecision | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.Booking).where(models.Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != models.BookingStatus.pending:
        raise HTTPException(status_code=400, detail="Booking is not pending")

    booking.status = models.BookingStatus.declined
    booking.decided_at = datetime.now(ZoneInfo("UTC"))
    if payload and payload.admin_note:
        booking.admin_note = payload.admin_note

    await db.commit()
    await db.refresh(booking)

    try:
        await send_booking_declined_email(booking)
    except Exception:
        pass

    return booking


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.Booking).where(models.Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    was_confirmed = booking.status == models.BookingStatus.confirmed

    # If confirmed with Zoom meeting, delete it
    if booking.zoom_meeting_id:
        try:
            await delete_meeting(booking.zoom_meeting_id)
        except Exception:
            pass

    settings = await _get_settings(db)

    # Send cancel notification before deleting
    if booking.status in (models.BookingStatus.pending, models.BookingStatus.confirmed):
        booking.status = models.BookingStatus.cancelled
        try:
            await send_booking_cancelled_email(booking, settings.timezone, cancelled_by_visitor=False)
        except Exception:
            pass

    await db.delete(booking)
    await db.commit()


# ── Availability CRUD ────────────────────────────────────────────────────────

@router.get("/availability", response_model=list[schemas.AvailabilityWindowResponse])
async def list_availability(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.AvailabilityWindow).order_by(models.AvailabilityWindow.day_of_week)
    )
    return result.scalars().all()


@router.post("/availability", response_model=schemas.AvailabilityWindowResponse, status_code=status.HTTP_201_CREATED)
async def create_availability(
    payload: schemas.AvailabilityWindowCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    window = models.AvailabilityWindow(**payload.model_dump())
    db.add(window)
    await db.commit()
    await db.refresh(window)
    return window


@router.put("/availability/{window_id}", response_model=schemas.AvailabilityWindowResponse)
async def update_availability(
    window_id: int,
    payload: schemas.AvailabilityWindowUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.AvailabilityWindow).where(models.AvailabilityWindow.id == window_id)
    )
    window = result.scalar_one_or_none()
    if not window:
        raise HTTPException(status_code=404, detail="Window not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(window, key, value)

    await db.commit()
    await db.refresh(window)
    return window


@router.delete("/availability/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability(
    window_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.AvailabilityWindow).where(models.AvailabilityWindow.id == window_id)
    )
    window = result.scalar_one_or_none()
    if not window:
        raise HTTPException(status_code=404, detail="Window not found")
    await db.delete(window)
    await db.commit()


# ── Blocked Dates CRUD ───────────────────────────────────────────────────────

@router.get("/blocked-dates", response_model=list[schemas.DateOverrideResponse])
async def list_blocked_dates(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    result = await db.execute(
        select(models.DateOverride).order_by(models.DateOverride.date)
    )
    return result.scalars().all()


@router.post("/blocked-dates", response_model=schemas.DateOverrideResponse, status_code=status.HTTP_201_CREATED)
async def create_blocked_date(
    payload: schemas.DateOverrideCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    override = models.DateOverride(**payload.model_dump())
    db.add(override)
    await db.commit()
    await db.refresh(override)
    return override


@router.delete("/blocked-dates/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blocked_date(
    override_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    result = await db.execute(
        select(models.DateOverride).where(models.DateOverride.id == override_id)
    )
    override = result.scalar_one_or_none()
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")
    await db.delete(override)
    await db.commit()


# ── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=schemas.BookingSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db), _: None = Depends(require_auth)):
    return await _get_settings(db)


@router.put("/settings", response_model=schemas.BookingSettingsResponse)
async def update_settings(
    payload: schemas.BookingSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    settings = await _get_settings(db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return settings


# ── Auto-decline background task (called from main.py) ──────────────────────

async def auto_decline_expired():
    """Decline pending bookings older than 48h. Called by supervised task in main.py."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        cutoff = datetime.now(ZoneInfo("UTC")) - timedelta(hours=48)
        result = await db.execute(
            select(models.Booking).where(
                and_(
                    models.Booking.status == models.BookingStatus.pending,
                    models.Booking.created_at < cutoff,
                )
            )
        )
        expired = result.scalars().all()
        count = 0
        for booking in expired:
            booking.status = models.BookingStatus.declined
            booking.admin_note = "Auto-declined: request expired"
            booking.decided_at = datetime.now(ZoneInfo("UTC"))
            try:
                await send_booking_declined_email(booking)
            except Exception:
                pass
            count += 1
        await db.commit()
        return f"{count} bookings auto-declined"


async def send_booking_reminders():
    """Send reminder emails/texts for confirmed bookings starting in ~1 hour."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        now = datetime.now(ZoneInfo("UTC"))
        window_start = now + timedelta(minutes=50)
        window_end = now + timedelta(minutes=70)
        result = await db.execute(
            select(models.Booking).where(
                and_(
                    models.Booking.status == models.BookingStatus.confirmed,
                    models.Booking.start_at >= window_start,
                    models.Booking.start_at <= window_end,
                    models.Booking.reminder_sent_at.is_(None),
                )
            )
        )
        bookings_list = result.scalars().all()
        settings = await _get_settings(db)
        count = 0
        for booking in bookings_list:
            try:
                await send_booking_reminder_email(booking, settings.timezone)
                time_str = _fmt_time(booking.start_at, settings.timezone)
                zoom_url = booking.zoom_join_url or "No Zoom link"
                msg = (
                    f"Reminder: Call in ~1 hour\n"
                    f"{booking.visitor_name} — {booking.topic}\n"
                    f"Time: {time_str}\n"
                    f"Zoom: {zoom_url}"
                )
                await imessage_service.send_alert(msg)
            except Exception:
                pass
            booking.reminder_sent_at = datetime.now(ZoneInfo("UTC"))
            count += 1
        await db.commit()
        return f"{count} reminders sent"
