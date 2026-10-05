"""Outbound mail goes through the house email gateway (email-api).

Why: one place owns the Brevo daily budget, the relay-down spool and the
iMessage paging, so the site no longer has to care whether postfix is up.
If the gateway itself is unreachable (or not configured, e.g. local dev),
we fall back to speaking SMTP to postfix directly, which is what this code
did before 2026-10-05.
"""
import base64
import logging
import os
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Sequence

import aiosmtplib
import httpx

log = logging.getLogger(__name__)

EMAIL_API_URL = os.getenv("EMAIL_API_URL", "http://email-api-app-1:4500").rstrip("/")
EMAIL_API_KEY = os.getenv("EMAIL_API_KEY", "")
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@nathanblatter.com")
DEFAULT_FROM = f"Nathan Blatter <{SMTP_FROM}>"


class Attachment:
    __slots__ = ("filename", "content", "content_type")

    def __init__(self, filename: str, content: bytes, content_type: str = ""):
        self.filename, self.content, self.content_type = filename, content, content_type


async def send(
    *,
    to: str,
    subject: str,
    text: str,
    html: Optional[str] = None,
    reply_to: Optional[str] = None,
    from_addr: Optional[str] = None,
    attachments: Sequence[Attachment] = (),
    client: Optional[httpx.AsyncClient] = None,
) -> bool:
    """Send one email. Returns True when accepted (sent or queued)."""
    if EMAIL_API_KEY:
        try:
            ok = await _send_gateway(to, subject, text, html, reply_to, from_addr, attachments, client)
            if ok is not None:
                return ok
        except httpx.HTTPError as e:
            log.warning("email gateway unreachable (%s); falling back to SMTP", e)
    return await _send_smtp(to, subject, text, html, reply_to, from_addr, attachments)


async def _send_gateway(to, subject, text, html, reply_to, from_addr, attachments, client) -> Optional[bool]:
    """True/False = gateway answered; None = server-side failure, try SMTP."""
    payload = {
        "from": from_addr or DEFAULT_FROM,
        "to": to,
        "subject": subject,
        "text": text,
    }
    if html:
        payload["html"] = html
    if reply_to:
        payload["reply_to"] = reply_to
    if attachments:
        payload["attachments"] = [
            {"filename": a.filename, "content": base64.b64encode(a.content).decode(), **({"content_type": a.content_type} if a.content_type else {})}
            for a in attachments
        ]
    headers = {"X-API-Key": EMAIL_API_KEY}
    own = client is None
    client = client or httpx.AsyncClient(timeout=30)
    try:
        r = await client.post(f"{EMAIL_API_URL}/send", json=payload, headers=headers)
    finally:
        if own:
            await client.aclose()
    if r.status_code in (200, 202):
        if r.status_code == 202:
            log.warning("email gateway queued %r (%s)", subject, r.text[:160])
        return True
    if 400 <= r.status_code < 500:
        # Our input was bad (or the key is wrong); SMTP would not do better.
        log.error("email gateway rejected %r: %s %s", subject, r.status_code, r.text[:200])
        return False
    log.warning("email gateway error %s: %s; falling back to SMTP", r.status_code, r.text[:200])
    return None


async def _send_smtp(to, subject, text, html, reply_to, from_addr, attachments) -> bool:
    if html or attachments:
        msg = MIMEMultipart("mixed")
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(text, "plain"))
        if html:
            alt.attach(MIMEText(html, "html"))
        msg.attach(alt)
        for a in attachments:
            main, _, sub = (a.content_type or "application/octet-stream").partition("/")
            part = MIMEText(a.content.decode("utf-8"), sub or "plain", "utf-8") if main == "text" else None
            if part is None:
                from email.mime.application import MIMEApplication
                part = MIMEApplication(a.content, _subtype=sub or "octet-stream")
            part.add_header("Content-Disposition", "attachment", filename=a.filename)
            msg.attach(part)
    else:
        msg = EmailMessage()
        msg.set_content(text)
    msg["Subject"] = subject
    msg["From"] = from_addr or DEFAULT_FROM
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to
    try:
        await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False, timeout=10)
        return True
    except Exception as e:
        log.warning("SMTP error (%r): %s", subject, e)
        return False
