"""Visitor-facing endpoints: session lifecycle, chat, and card content."""

import json
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from .. import db
from ..agent import agent
from ..config import get_settings
from ..content import get_content
from ..services.geo import enrich_session
from .deps import client_ip, limiter

router = APIRouter(prefix="/api")


class StartRequest(BaseModel):
    session_id: str | None = None


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str


def _history_payload(session_id: str) -> list[dict]:
    return [
        {"role": m["role"], "content": m["content"],
         "cards": [c for c in m["cards"] if c.get("type") != "riddle"],
         "suggestions": m["suggestions"]}
        for m in db.get_messages(session_id)
    ]


@router.get("/content")
def content():
    return get_content().public_payload()


@router.post("/session/start")
def start_session(body: StartRequest, request: Request, tasks: BackgroundTasks):
    ip = client_ip(request)

    # Resume the same tab's session after a reload, unless it already ended.
    if body.session_id and (existing := db.get_session(body.session_id)) and not existing["ended_at"]:
        db.update_session(existing["id"], end_requested_at=None, last_active_at=db.ts())
        return {"session_id": existing["id"], "resumed": True, "messages": _history_payload(existing["id"])}

    if not limiter.hit(f"start:{ip}", limit=20, window_s=3600):
        raise HTTPException(429, "Whoa, that's a lot of fresh starts. Take a breather and try again in a bit 🙂")

    sid = uuid.uuid4().hex
    db.create_session(sid, ip, request.headers.get("user-agent", ""))
    tasks.add_task(enrich_session, sid, ip)
    opener = agent.opener()
    db.add_message(sid, "assistant", opener["reply"], [], opener["suggestions"], "scripted")
    return {"session_id": sid, "resumed": False,
            "messages": [{"role": "assistant", "content": opener["reply"], "cards": [],
                          "suggestions": opener["suggestions"]}]}


@router.post("/chat")
def chat(body: ChatRequest, request: Request):
    s = get_settings()
    ip = client_ip(request)
    message = body.message.strip()

    session = db.get_session(body.session_id)
    if not session:
        raise HTTPException(404, "Unknown session")
    if session["ended_at"]:
        raise HTTPException(410, "Session ended")
    if not message:
        raise HTTPException(422, "Say something! Even 'hi' works 🙂")
    if len(message) > s.max_message_chars:
        raise HTTPException(422, f"That's an essay! 📜 Keep it under {s.max_message_chars} characters, please.")
    if session["user_message_count"] >= s.max_messages_per_session:
        raise HTTPException(429, "We've covered a LOT in this chat 😄 Refresh the page to start a new one, "
                                 "or reach Bhavya directly via the contact card.")
    if not limiter.hit(f"chat:{ip}", s.rate_limit_messages, s.rate_limit_window_s):
        raise HTTPException(429, "Easy there, speed typist ⚡ Give me a minute to catch my breath, then ask away.")

    if session["end_requested_at"]:
        db.update_session(session["id"], end_requested_at=None)
    return agent.respond(session, message, ip)


@router.post("/session/end")
async def end_session(request: Request):
    """Called with navigator.sendBeacon on pagehide. Only *requests* the end: the reaper
    closes it after a short grace period, so a page reload can resume the session."""
    try:
        sid = json.loads(await request.body() or b"{}").get("session_id")
    except (json.JSONDecodeError, AttributeError):
        sid = None
    if sid and (session := db.get_session(sid)) and not session["ended_at"]:
        db.update_session(sid, end_requested_at=db.ts())
    return {"ok": True}
