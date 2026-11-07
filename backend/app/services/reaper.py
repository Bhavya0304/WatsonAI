"""Background loop: closes idle sessions (and emails them), retries failed emails,
and prunes request rows older than the log retention window."""

import asyncio
import logging

from .. import db
from ..config import get_settings
from .email import send_session_email

log = logging.getLogger("watson.reaper")


def end_session(session_id: str) -> None:
    session = db.get_session(session_id)
    if not session:
        return
    if not session.get("ended_at"):
        db.update_session(session_id, ended_at=db.ts())
    send_session_email(session_id)


def sweep() -> None:
    s = get_settings()
    for session in db.idle_sessions_to_close(s.session_idle_minutes):
        end_session(session["id"])
    # Retry sessions that ended but whose email failed.
    with db.connect() as c:
        pending = [r[0] for r in c.execute(
            "SELECT id FROM sessions WHERE ended_at IS NOT NULL AND emailed_at IS NULL "
            "AND user_message_count > 0 AND ended_at > ? "
            "AND (email_status IS NULL OR (email_status LIKE 'failed@%' AND substr(email_status, 8) < ?))",
            (db.ts_ago(days=2), db.ts_ago(minutes=15))).fetchall()]
    for sid in pending:
        send_session_email(sid)
    pruned = db.prune_requests(s.log_retention_days)
    if pruned:
        log.info("pruned %s old request rows", pruned)


async def run_forever() -> None:
    s = get_settings()
    while True:
        try:
            await asyncio.to_thread(sweep)
        except Exception:
            log.exception("reaper sweep failed")
        await asyncio.sleep(s.reaper_interval_s)
