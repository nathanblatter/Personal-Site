import logging
import os
import uuid
import aiosmtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@nathanblatter.com")
SITE_URL = os.getenv("SITE_URL", "https://nathanblatter.com")


async def send_testimonial_request_email(req) -> bool:
    """Send testimonial request email. Returns True on success."""
    if not req.requester_email:
        return False

    link = f"{SITE_URL}/go/{req.slug}"
    first_name = req.requester_name.split()[0]

    personal_block = ""
    if req.personal_message:
        personal_block = f"""
        <div style="background:#f0f4ff;border-left:3px solid #3b6cf5;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;color:#374151;font-style:italic;font-size:14px;line-height:1.6;">
          &ldquo;{req.personal_message}&rdquo;
        </div>"""

    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
      <p style="font-family:monospace;font-size:11px;color:#3b6cf5;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Testimonial Request</p>
      <h1 style="font-size:28px;color:#1a1f2e;margin:0 0 8px;font-weight:700;">Hey {first_name} 👋</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 8px;">Nathan Blatter would love a few kind words from you.</p>
      {personal_block}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:24px 0;">
        Click below to share a short testimonial — it only takes a couple of minutes and means a lot.
      </p>
      <a href="{link}" style="display:inline-block;background:#3b6cf5;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.01em;">
        Share Your Testimonial &rarr;
      </a>
      <p style="margin-top:28px;font-size:12px;color:#9ca3af;word-break:break-all;">
        Or copy this link: <a href="{link}" style="color:#3b6cf5;">{link}</a>
      </p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">
      Sent from <a href="{SITE_URL}" style="color:#9ca3af;">nathanblatter.com</a>
    </p>
  </div>
</body>
</html>"""

    text_body = f"""Hey {first_name},

Nathan Blatter would love a few kind words from you.

{f'A note from Nathan: "{req.personal_message}"' if req.personal_message else ''}

Click the link below to share a short testimonial:
{link}

It only takes a couple of minutes.

— nathanblatter.com
"""

    msg = EmailMessage()
    msg["Subject"] = "Nathan Blatter would love your testimonial"
    msg["From"] = f"Nathan Blatter <{SMTP_FROM}>"
    msg["To"] = req.requester_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False)
        return True
    except Exception as e:
        log.warning("SMTP error: %s", e)
        return False


# ── Booking emails ───────────────────────────────────────────────────────────

CONTACT_TO_EMAIL = os.getenv("CONTACT_TO_EMAIL", "nzb22@byu.edu")


def _build_ics(summary: str, start: datetime, duration_minutes: int,
               location: str, description: str,
               organizer_email: str, attendee_email: str) -> str:
    """Return RFC 5545 VCALENDAR string with METHOD:REQUEST."""
    end = start + timedelta(minutes=duration_minutes)
    fmt = "%Y%m%dT%H%M%SZ"
    uid = f"{uuid.uuid4()}@nathanblatter.com"
    return (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//nathanblatter.com//Booking//EN\r\n"
        "METHOD:REQUEST\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTART:{start.strftime(fmt)}\r\n"
        f"DTEND:{end.strftime(fmt)}\r\n"
        f"SUMMARY:{summary}\r\n"
        f"LOCATION:{location}\r\n"
        f"DESCRIPTION:{description}\r\n"
        f"ORGANIZER;CN=Nathan Blatter:mailto:{organizer_email}\r\n"
        f"ATTENDEE;CN=Visitor:mailto:{attendee_email}\r\n"
        "STATUS:CONFIRMED\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )


async def _send_mime(to: str, subject: str, text_body: str, html_body: str,
                     ics_content: str | None = None) -> bool:
    """Send a MIME email, optionally with .ics attachment."""
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"Nathan Blatter <{SMTP_FROM}>"
    msg["To"] = to

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain"))
    alt.attach(MIMEText(html_body, "html"))
    msg.attach(alt)

    if ics_content:
        cal = MIMEText(ics_content, "calendar", "utf-8")
        cal.add_header("Content-Disposition", "attachment", filename="invite.ics")
        msg.attach(cal)

    try:
        await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False)
        return True
    except Exception as e:
        log.warning("SMTP error (booking): %s", e)
        return False


def _fmt_time(dt: datetime, tz_name: str) -> str:
    """Format datetime in a given timezone for display."""
    from zoneinfo import ZoneInfo
    local = dt.astimezone(ZoneInfo(tz_name))
    return local.strftime("%A, %B %-d at %-I:%M %p %Z")


async def send_booking_request_email(booking, admin_tz: str = "America/Denver",
                                     accept_token: str | None = None,
                                     decline_token: str | None = None) -> bool:
    """Notify Nathan of a new booking request with optional accept/decline magic links."""
    time_str = _fmt_time(booking.start_at, admin_tz)
    subject = f"New booking request: {booking.topic} — {booking.visitor_name}"
    admin_link = f"{SITE_URL}/admin"

    accept_url = f"{SITE_URL}/api/v1/bookings/action?token={accept_token}" if accept_token else ""
    decline_url = f"{SITE_URL}/api/v1/bookings/action?token={decline_token}" if decline_token else ""

    text_body = (
        f"New booking request from {booking.visitor_name} ({booking.visitor_email})\n\n"
        f"Topic: {booking.topic}\n"
        f"Time: {time_str} ({booking.duration_minutes} min)\n\n"
        f"Review in admin: {admin_link}"
    )
    if accept_url:
        text_body += f"\n\nQuick actions:\nAccept: {accept_url}\nDecline: {decline_url}"

    action_buttons = ""
    if accept_url:
        action_buttons = f"""
  <div style="margin-top:24px;display:flex;gap:12px;">
    <a href="{accept_url}" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:14px;">
      Accept
    </a>
    <a href="{decline_url}" style="display:inline-block;background:#ef4444;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:14px;">
      Decline
    </a>
  </div>
  <p style="margin-top:12px;font-size:11px;color:#9ca3af;">Or review in <a href="{admin_link}" style="color:#3b6cf5;">admin</a></p>"""
    else:
        action_buttons = f"""
  <a href="{admin_link}" style="display:inline-block;margin-top:24px;background:#3b6cf5;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
    Review in Admin &rarr;
  </a>"""

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#3b6cf5;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">New Booking Request</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">{booking.visitor_name}</h1>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Email:</strong> {booking.visitor_email}</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Topic:</strong> {booking.topic}</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Time:</strong> {time_str} ({booking.duration_minutes} min)</p>
  {action_buttons}
</div>
</div></body></html>"""

    return await _send_mime(CONTACT_TO_EMAIL, subject, text_body, html_body)


async def send_booking_confirmed_email(booking, admin_tz: str = "America/Denver", cancel_token: str | None = None) -> bool:
    """Send confirmation with Zoom link and .ics to both Nathan and visitor."""
    time_str = _fmt_time(booking.start_at, admin_tz)
    subject = f"Call confirmed: {booking.topic}"
    zoom_url = booking.zoom_join_url or "Zoom link not available"

    ics = _build_ics(
        summary=f"Call: {booking.topic}",
        start=booking.start_at,
        duration_minutes=booking.duration_minutes,
        location=zoom_url,
        description=f"Call with {booking.visitor_name} — {booking.topic}",
        organizer_email=CONTACT_TO_EMAIL,
        attendee_email=booking.visitor_email,
    )

    cancel_link = f"{SITE_URL}/api/v1/bookings/action?token={cancel_token}" if cancel_token else ""

    text_body = (
        f"Your call has been confirmed!\n\n"
        f"Topic: {booking.topic}\n"
        f"Time: {time_str} ({booking.duration_minutes} min)\n"
        f"Zoom: {zoom_url}\n\n"
        f"A calendar invite is attached."
    )
    if cancel_link:
        text_body += f"\n\nNeed to cancel? {cancel_link}"

    cancel_html = ""
    if cancel_link:
        cancel_html = f'<p style="margin-top:16px;"><a href="{cancel_link}" style="color:#ef4444;font-size:12px;text-decoration:underline;">Need to cancel this booking?</a></p>'

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#10b981;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Call Confirmed</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">{booking.topic}</h1>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Time:</strong> {time_str} ({booking.duration_minutes} min)</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>With:</strong> {booking.visitor_name}</p>
  <a href="{zoom_url}" style="display:inline-block;margin-top:24px;background:#2563eb;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
    Join Zoom Meeting &rarr;
  </a>
  <p style="margin-top:20px;font-size:12px;color:#9ca3af;">A calendar invite (.ics) is attached to this email.</p>
  {cancel_html}
</div>
</div></body></html>"""

    ok1 = await _send_mime(booking.visitor_email, subject, text_body, html_body, ics)
    ok2 = await _send_mime(CONTACT_TO_EMAIL, subject, text_body, html_body, ics)
    return ok1 and ok2


async def send_booking_declined_email(booking) -> bool:
    """Send polite decline email to visitor."""
    subject = "Re: your booking request with Nathan Blatter"

    reason = ""
    if booking.admin_note:
        reason = f"\n\nA note from Nathan: \"{booking.admin_note}\""

    text_body = (
        f"Hi {booking.visitor_name},\n\n"
        f"Unfortunately, Nathan isn't able to accommodate your booking request "
        f"for \"{booking.topic}\" at this time.{reason}\n\n"
        f"Feel free to reach out via the contact form at {SITE_URL}/contact "
        f"if you'd like to get in touch another way.\n\n"
        f"Best,\nNathan Blatter"
    )

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#64748b;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Booking Update</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">Hi {booking.visitor_name}</h1>
  <p style="color:#374151;font-size:14px;line-height:1.6;">
    Unfortunately, Nathan isn't able to accommodate your booking request
    for &ldquo;{booking.topic}&rdquo; at this time.
  </p>
  {"<p style='color:#374151;font-size:14px;line-height:1.6;margin-top:12px;font-style:italic;'>&ldquo;" + booking.admin_note + "&rdquo;</p>" if booking.admin_note else ""}
  <p style="color:#374151;font-size:14px;line-height:1.6;margin-top:20px;">
    Feel free to reach out via the <a href="{SITE_URL}/contact" style="color:#3b6cf5;">contact form</a> if you'd like to get in touch another way.
  </p>
  <p style="color:#9ca3af;font-size:13px;margin-top:24px;">Best,<br>Nathan Blatter</p>
</div>
</div></body></html>"""

    return await _send_mime(booking.visitor_email, subject, text_body, html_body)


async def send_booking_cancelled_email(booking, admin_tz: str = "America/Denver",
                                        cancelled_by_visitor: bool = False) -> bool:
    """Send cancellation notification to both parties."""
    time_str = _fmt_time(booking.start_at, admin_tz)
    who = booking.visitor_name if cancelled_by_visitor else "Nathan"
    subject = f"Booking cancelled: {booking.topic}"

    text_body = (
        f"The booking for \"{booking.topic}\" on {time_str} has been cancelled by {who}.\n\n"
        f"Visitor: {booking.visitor_name} ({booking.visitor_email})\n"
        f"Duration: {booking.duration_minutes} min"
    )

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#ef4444;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Booking Cancelled</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">{booking.topic}</h1>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Time:</strong> {time_str} ({booking.duration_minutes} min)</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Cancelled by:</strong> {who}</p>
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin-top:20px;">
    This booking has been cancelled. If you'd like to reschedule, visit the
    <a href="{SITE_URL}/contact" style="color:#3b6cf5;">contact page</a>.
  </p>
</div>
</div></body></html>"""

    # Notify the other party (and Nathan always gets a copy)
    ok1 = await _send_mime(booking.visitor_email, subject, text_body, html_body)
    if not cancelled_by_visitor:
        return ok1
    ok2 = await _send_mime(CONTACT_TO_EMAIL, subject, text_body, html_body)
    return ok1 and ok2
