"""mail_gateway: gateway-first with SMTP fallback."""
import base64
import json

import httpx
import pytest

from app import mail_gateway


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_posts_structured_message_to_gateway(monkeypatch):
    monkeypatch.setattr(mail_gateway, "EMAIL_API_KEY", "k")
    seen = {}

    def handler(req: httpx.Request):
        seen["url"] = str(req.url)
        seen["key"] = req.headers.get("X-API-Key")
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"status": "sent"})

    ok = await mail_gateway.send(
        to="a@x.com", subject="Hi", text="t", html="<p>t</p>", reply_to="r@x.com",
        attachments=[mail_gateway.Attachment("invite.ics", b"BEGIN:VCALENDAR", "text/calendar")],
        client=_client(handler),
    )
    assert ok is True
    assert seen["url"].endswith("/send") and seen["key"] == "k"
    b = seen["body"]
    assert b["to"] == "a@x.com" and b["reply_to"] == "r@x.com" and b["html"] == "<p>t</p>"
    assert b["from"].endswith("<noreply@nathanblatter.com>")
    assert b["attachments"][0]["filename"] == "invite.ics"
    assert base64.b64decode(b["attachments"][0]["content"]) == b"BEGIN:VCALENDAR"
    assert b["attachments"][0]["content_type"] == "text/calendar"


@pytest.mark.asyncio
async def test_queued_counts_as_accepted(monkeypatch):
    monkeypatch.setattr(mail_gateway, "EMAIL_API_KEY", "k")
    client = _client(lambda req: httpx.Response(202, json={"status": "queued", "reason": "relay_down"}))
    assert await mail_gateway.send(to="a@x.com", subject="s", text="t", client=client) is True


@pytest.mark.asyncio
async def test_client_error_is_final_no_smtp(monkeypatch):
    monkeypatch.setattr(mail_gateway, "EMAIL_API_KEY", "k")
    called = []

    async def fake_smtp(*a, **kw):
        called.append(1)

    monkeypatch.setattr(mail_gateway.aiosmtplib, "send", fake_smtp)
    client = _client(lambda req: httpx.Response(400, json={"status": "rejected", "error": "bad from"}))
    assert await mail_gateway.send(to="a@x.com", subject="s", text="t", client=client) is False
    assert called == []


@pytest.mark.asyncio
async def test_gateway_down_falls_back_to_smtp(monkeypatch):
    monkeypatch.setattr(mail_gateway, "EMAIL_API_KEY", "k")
    sent = {}

    async def fake_smtp(msg, **kw):
        sent["to"] = msg["To"]
        sent["from"] = msg["From"]
        sent["reply_to"] = msg["Reply-To"]
        sent["subject"] = msg["Subject"]

    monkeypatch.setattr(mail_gateway.aiosmtplib, "send", fake_smtp)

    def down(req):
        raise httpx.ConnectError("refused")

    ok = await mail_gateway.send(to="a@x.com", subject="s", text="t", reply_to="r@x.com", client=_client(down))
    assert ok is True
    assert sent == {"to": "a@x.com", "from": mail_gateway.DEFAULT_FROM, "reply_to": "r@x.com", "subject": "s"}

    # 5xx from the gateway also falls back.
    client = _client(lambda req: httpx.Response(500, json={"status": "failed"}))
    assert await mail_gateway.send(to="b@x.com", subject="s2", text="t", client=client) is True
    assert sent["to"] == "b@x.com"


@pytest.mark.asyncio
async def test_no_key_means_direct_smtp(monkeypatch):
    monkeypatch.setattr(mail_gateway, "EMAIL_API_KEY", "")
    sent = {}

    async def fake_smtp(msg, **kw):
        sent["payload"] = msg.get_payload() if not msg.is_multipart() else "multipart"

    monkeypatch.setattr(mail_gateway.aiosmtplib, "send", fake_smtp)
    assert await mail_gateway.send(to="a@x.com", subject="s", text="plain only") is True
    assert sent["payload"].strip() == "plain only"
