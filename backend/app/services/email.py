"""Emails Bhavya the full transcript when a session ends (Gmail SMTP + App Password)."""

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage

from .. import db
from ..settings_store import EmailSettings, get_email_settings
from ..logging_setup import log_event

log = logging.getLogger("watson.email")


def _row(label: str, value) -> str:
    return (f"<tr><td style='padding:4px 12px 4px 0;color:#64748b'>{html.escape(label)}</td>"
            f"<td style='padding:4px 0;color:#0f172a'>{html.escape(str(value)) if value not in (None, '') else '—'}</td></tr>")


def render(session: dict, messages: list[dict], providers: list[str]) -> tuple[str, str]:
    who = session.get("visitor_name") or "Anonymous visitor"
    where = ", ".join(x for x in (session.get("city"), session.get("region"), session.get("country")) if x) or "Unknown"
    subject = f"Watson chat: {who} ({where}), {session['user_message_count']} messages"

    summary = "".join([
        _row("Visitor", who),
        _row("Relation", session.get("visitor_relation")),
        _row("Company / role", session.get("visitor_company")),
        _row("Email", session.get("visitor_email")),
        _row("Prefers privacy", "yes" if session.get("visitor_declined") else "no"),
        _row("IP", session.get("ip")),
        _row("Location", where),
        _row("Device", session.get("user_agent")),
        _row("Started (UTC)", session.get("started_at")),
        _row("Last active (UTC)", session.get("last_active_at")),
        _row("Models used", ", ".join(providers) or "none"),
        _row("OpenAI cost", f"${session.get('cost_usd') or 0:.4f}"),
        _row("Session ID", session["id"]),
    ])

    bubbles = []
    for m in messages:
        mine = m["role"] == "user"
        cards = ", ".join(f"{c['type']}:{c['id']}" for c in m.get("cards") or [])
        bubbles.append(
            f"<div style='margin:8px 0;text-align:{'right' if mine else 'left'}'>"
            f"<div style='display:inline-block;max-width:80%;text-align:left;padding:10px 14px;border-radius:14px;"
            f"background:{'#6d28d9' if mine else '#f1f5f9'};color:{'#fff' if mine else '#0f172a'};white-space:pre-wrap'>"
            f"{html.escape(m['content'])}</div>"
            f"<div style='font-size:11px;color:#94a3b8;margin-top:2px'>{'Visitor' if mine else 'Watson'} · {m['created_at']}"
            f"{' · ' + html.escape(m['provider']) if m.get('provider') else ''}"
            f"{' · cards: ' + html.escape(cards) if cards else ''}</div></div>"
        )

    body = (
        "<div style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:auto'>"
        f"<h2 style='color:#0f172a'>New Watson conversation</h2>"
        f"<table style='font-size:14px;border-collapse:collapse'>{summary}</table>"
        "<h3 style='color:#0f172a;margin-top:24px'>Transcript</h3>"
        f"{''.join(bubbles)}</div>"
    )
    return subject, body


def deliver(es: EmailSettings, subject: str, html_body: str, reply_to: str | None = None) -> None:
    """Send one HTML email. Port 465 uses implicit SSL; anything else uses STARTTLS."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{es.from_name} <{es.smtp_user}>"
    msg["To"] = es.notify_email
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content("This email needs an HTML-capable client.")
    msg.add_alternative(html_body, subtype="html")
    ctx = ssl.create_default_context()
    if es.smtp_port == 465:
        with smtplib.SMTP_SSL(es.smtp_host, es.smtp_port, context=ctx, timeout=20) as smtp:
            smtp.login(es.smtp_user, es.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(es.smtp_host, es.smtp_port, timeout=20) as smtp:
            smtp.starttls(context=ctx)
            smtp.login(es.smtp_user, es.smtp_password)
            smtp.send_message(msg)


def send_test_email() -> None:
    es = get_email_settings()
    if not es.configured:
        raise ValueError("SMTP is not fully configured (host, user, password and recipient are required).")
    deliver(es, "Watson test email ✅",
            "<div style='font-family:sans-serif'><h2>It works!</h2>"
            "<p>Watson can send you session transcripts with these SMTP settings.</p></div>")


def send_session_email(session_id: str) -> bool:
    session = db.get_session(session_id)
    if not session or session.get("emailed_at") or not session.get("user_message_count"):
        return False
    # Claim it first so a beacon and the reaper can't both send it.
    db.update_session(session_id, emailed_at=db.ts())

    es = get_email_settings()
    if not es.enabled:
        db.update_session(session_id, email_status="skipped: disabled")
        log_event("email", "transcript email disabled in settings; skipped", session_id=session_id)
        return False
    if not es.configured:
        db.update_session(session_id, email_status="skipped: smtp not configured")
        log_event("email", "smtp not configured; skipped transcript email", session_id=session_id)
        return False

    messages = db.get_messages(session_id)
    providers = sorted({m["provider"] for m in messages if m.get("provider")})
    subject, body = render(session, messages, providers)

    try:
        deliver(es, subject, body, session.get("visitor_email"))
        db.update_session(session_id, email_status="sent")
        log_event("email", "transcript email sent", session_id=session_id)
        return True
    except Exception as ex:
        db.update_session(session_id, emailed_at=None, email_status=f"failed@{db.ts()}")  # reaper retries later
        log.exception("failed to send transcript email for %s", session_id)
        log_event("email", "transcript email failed", session_id=session_id, error=str(ex)[:300])
        return False
