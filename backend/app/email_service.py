import logging
import os
import aiosmtplib
from email.message import EmailMessage

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
