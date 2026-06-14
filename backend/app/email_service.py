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


def _btn(href: str, label: str) -> str:
    return (f'<a href="{href}" style="display:inline-block;background:#3b6cf5;color:#fff;text-decoration:none;'
            f'font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">{label}</a>')


def _wrap(inner: str) -> str:
    return (f'<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;'
            f'padding:8px;color:#2d3342">{inner}'
            f'<p style="font-size:12px;color:#8c95a6;margin-top:24px">Nathan Blatter · '
            f'<a href="{SITE_URL}" style="color:#8c95a6">nathanblatter.com</a></p></div>')


async def send_contract_email(to: str, contract_title: str, link: str, reminder: bool = False) -> bool:
    verb = "A reminder to sign" if reminder else "You've been sent a contract to sign"
    subject = (f"Reminder: please sign “{contract_title}”" if reminder
               else f"Nathan Blatter sent you a contract to sign — {contract_title}")
    text = f"{verb}: {contract_title}\n\nReview and sign here:\n{link}\n\nNathan has already signed."
    html = _wrap(
        f'<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8c95a6;margin:0 0 6px">'
        f'{"Signature reminder" if reminder else "Contract for signature"}</p>'
        f'<p style="font-size:15px;margin:0 0 18px">{verb}: <strong>{contract_title}</strong>. '
        f'Review the document and add your signature — Nathan has already signed.</p>'
        f'<div style="margin:0 0 18px">{_btn(link, "Review &amp; sign")}</div>'
        f'<p style="font-size:12px;color:#8c95a6;margin:0">Or paste this link: <br>{link}</p>')
    return await _send_mime(to, subject, text, html)


async def send_invoice_email(to: str, number: str, amount: str, link: str,
                             due: str | None = None, reminder: bool = False) -> bool:
    due_line = f" · due {due}" if due else ""
    subject = (f"Reminder: invoice {number} ({amount}){' is overdue' if reminder else ''}"
               if reminder else f"Invoice {number} from Nathan Blatter — {amount}")
    lead = ("This is a friendly reminder about an unpaid invoice"
            if reminder else "You have a new invoice")
    text = f"{lead}: {number} for {amount}{due_line}.\n\nView it here:\n{link}"
    html = _wrap(
        f'<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8c95a6;margin:0 0 6px">'
        f'{"Payment reminder" if reminder else "New invoice"}</p>'
        f'<p style="font-size:15px;margin:0 0 6px">{lead}:</p>'
        f'<p style="font-size:22px;font-weight:700;margin:0 0 4px">{number} — {amount}</p>'
        f'<p style="font-size:13px;color:#8c95a6;margin:0 0 18px">{("Due " + due) if due else ""}</p>'
        f'<div style="margin:0 0 18px">{_btn(link, "View invoice")}</div>'
        f'<p style="font-size:12px;color:#8c95a6;margin:0">Or paste this link: <br>{link}</p>')
    return await _send_mime(to, subject, text, html)


async def send_contract_otp_email(to: str, code: str, contract_title: str) -> bool:
    """Send a 6-digit verification code for signing a contract."""
    subject = f"Your code to sign “{contract_title}”: {code}"
    text = (
        f"Your verification code to sign “{contract_title}” is:\n\n"
        f"    {code}\n\n"
        f"Enter this code on the signing page to confirm your identity. "
        f"It expires in 10 minutes. If you didn’t request this, you can ignore this email."
    )
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:8px">
  <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8c95a6;margin:0 0 6px">Signature verification</p>
  <p style="font-size:15px;color:#2d3342;margin:0 0 18px">Use this code to confirm your identity and sign
    <strong>{contract_title}</strong>.</p>
  <div style="font-family:'JetBrains Mono',monospace;font-size:34px;letter-spacing:.3em;font-weight:700;
              color:#3b6cf5;background:#eef3ff;border-radius:12px;padding:18px;text-align:center">{code}</div>
  <p style="font-size:13px;color:#8c95a6;margin:18px 0 0">Expires in 10 minutes. If you didn’t request this, ignore this email.</p>
</div>"""
    return await _send_mime(to, subject, text, html)


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
  <p style="margin-top:12px;font-size:12px;color:#9ca3af;">Want to book another call later? Visit <a href="{SITE_URL}/contact" style="color:#3b6cf5;">nathanblatter.com/contact</a></p>
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
    Feel free to <a href="{SITE_URL}/contact" style="color:#3b6cf5;">book a different time</a> or reach out via the contact form.
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
    This booking has been cancelled. <a href="{SITE_URL}/contact" style="color:#3b6cf5;font-weight:600;">Reschedule a call &rarr;</a>
  </p>
</div>
</div></body></html>"""

    # Notify the other party (and Nathan always gets a copy)
    ok1 = await _send_mime(booking.visitor_email, subject, text_body, html_body)
    if not cancelled_by_visitor:
        return ok1
    ok2 = await _send_mime(CONTACT_TO_EMAIL, subject, text_body, html_body)
    return ok1 and ok2


async def send_booking_received_email(booking) -> bool:
    """Send acknowledgment email to visitor when they submit a booking request."""
    subject = f"Booking request received — {booking.topic}"
    first_name = booking.visitor_name.split()[0]

    text_body = (
        f"Hi {first_name},\n\n"
        f"Thanks for requesting a call! Nathan has been notified and will review your "
        f"request within 48 hours.\n\n"
        f"Topic: {booking.topic}\n"
        f"Duration: {booking.duration_minutes} min\n\n"
        f"You'll receive another email once Nathan accepts or declines.\n\n"
        f"— nathanblatter.com"
    )

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#3b6cf5;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Request Received</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">Thanks, {first_name}!</h1>
  <p style="color:#374151;font-size:14px;line-height:1.6;">
    Your call request has been received. Nathan will review it and get back to you within 48 hours.
  </p>
  <div style="margin-top:20px;padding:16px;background:#f0f4ff;border-radius:10px;">
    <p style="color:#374151;font-size:14px;margin:4px 0;"><strong>Topic:</strong> {booking.topic}</p>
    <p style="color:#374151;font-size:14px;margin:4px 0;"><strong>Duration:</strong> {booking.duration_minutes} min</p>
  </div>
  <p style="color:#64748b;font-size:13px;line-height:1.6;margin-top:20px;">
    If accepted, you'll receive a Zoom link and calendar invite by email.
  </p>
</div>
<p style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">
  Sent from <a href="{SITE_URL}" style="color:#9ca3af;">nathanblatter.com</a>
</p>
</div></body></html>"""

    return await _send_mime(booking.visitor_email, subject, text_body, html_body)


async def send_booking_reminder_email(booking, admin_tz: str = "America/Denver") -> bool:
    """Send reminder email to both parties ~1 hour before a confirmed call."""
    time_str = _fmt_time(booking.start_at, admin_tz)
    subject = f"Reminder: Call in 1 hour — {booking.topic}"
    zoom_url = booking.zoom_join_url or "Zoom link not available"

    text_body = (
        f"Quick reminder — your call starts in about 1 hour.\n\n"
        f"Topic: {booking.topic}\n"
        f"Time: {time_str} ({booking.duration_minutes} min)\n"
        f"Zoom: {zoom_url}\n"
    )

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 20px;">
<div style="background:white;border-radius:16px;padding:48px 40px;border:1px solid #e5e7eb;">
  <p style="font-family:monospace;font-size:11px;color:#f59e0b;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Reminder</p>
  <h1 style="font-size:24px;color:#1a1f2e;margin:0 0 16px;font-weight:700;">Call in 1 hour</h1>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Topic:</strong> {booking.topic}</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>Time:</strong> {time_str}</p>
  <p style="color:#374151;font-size:14px;margin:8px 0;"><strong>With:</strong> {booking.visitor_name}</p>
  <a href="{zoom_url}" style="display:inline-block;margin-top:24px;background:#2563eb;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
    Join Zoom Meeting &rarr;
  </a>
</div>
</div></body></html>"""

    ok1 = await _send_mime(booking.visitor_email, subject, text_body, html_body)
    ok2 = await _send_mime(CONTACT_TO_EMAIL, subject, text_body, html_body)
    return ok1 and ok2
