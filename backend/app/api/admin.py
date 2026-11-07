"""Admin dashboard API. Cookie-session auth with credentials from .env."""

import re
import secrets
from collections import deque

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ValidationError

from .. import db
from ..config import get_settings
from ..content_store import editable_payload, save_section
from ..logging_setup import log_event
from ..rag.index import ensure_index, index_status
from ..services.email import send_test_email
from ..settings_store import get_email_settings, save_email_settings
from ..llm.router import openai_budget_status, provider_states, reset_openai
from .deps import client_ip, limiter

router = APIRouter(prefix="/api/admin")


def require_admin(request: Request) -> None:
    if not request.session.get("admin"):
        raise HTTPException(401, "Not logged in")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, request: Request):
    s = get_settings()
    ip = client_ip(request)
    key = f"admin-fail:{ip}"
    window = s.admin_lockout_minutes * 60
    if limiter.count(key, window) >= s.admin_max_failed_logins:
        raise HTTPException(429, f"Too many failed attempts. Try again in {s.admin_lockout_minutes} minutes.")
    ok_user = secrets.compare_digest(body.username.encode(), s.admin_username.encode())
    ok_pass = secrets.compare_digest(body.password.encode(), s.admin_password.encode())
    if not (ok_user and ok_pass):
        limiter.hit(key, limit=10_000, window_s=window)
        raise HTTPException(401, "Invalid username or password")
    limiter.reset(key)
    request.session["admin"] = True
    return {"ok": True}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me", dependencies=[Depends(require_admin)])
def me():
    return {"ok": True, "username": get_settings().admin_username}


def _scalar(sql: str, *args) -> float:
    with db.connect() as c:
        return c.execute(sql, args).fetchone()[0] or 0


@router.get("/stats", dependencies=[Depends(require_admin)])
def stats():
    out = {}
    for label, days in (("7d", 7), ("30d", 30)):
        since = db.ts_ago(days=days)
        out[label] = {
            "sessions": _scalar("SELECT COUNT(*) FROM sessions WHERE started_at>=? AND user_message_count>0", since),
            "visits": _scalar("SELECT COUNT(*) FROM sessions WHERE started_at>=?", since),
            "unique_ips": _scalar("SELECT COUNT(DISTINCT ip) FROM sessions WHERE started_at>=?", since),
            "messages": _scalar("SELECT COUNT(*) FROM messages WHERE role='user' AND created_at>=?", since),
        }
    with db.connect() as c:
        by_provider = [dict(r) for r in c.execute(
            "SELECT provider, COUNT(*) AS calls, SUM(status='ok') AS ok, SUM(status='error') AS errors, "
            "SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, "
            "ROUND(SUM(cost_usd), 4) AS cost_usd FROM llm_calls WHERE created_at>=? GROUP BY provider",
            (db.ts_ago(days=30),)).fetchall()]
        daily = [dict(r) for r in c.execute(
            "SELECT substr(started_at,1,10) AS day, COUNT(*) AS visits, SUM(user_message_count>0) AS sessions, "
            "SUM(user_message_count) AS messages FROM sessions WHERE started_at>=? GROUP BY day ORDER BY day",
            (db.ts_ago(days=30),)).fetchall()]
        countries = [dict(r) for r in c.execute(
            "SELECT COALESCE(country,'Unknown') AS country, COUNT(*) AS sessions FROM sessions "
            "WHERE started_at>=? GROUP BY country ORDER BY sessions DESC LIMIT 10",
            (db.ts_ago(days=30),)).fetchall()]
    out.update(providers=by_provider, daily=daily, countries=countries,
               budget=openai_budget_status(), provider_states=provider_states())
    return out


@router.post("/openai/reset", dependencies=[Depends(require_admin)])
def openai_reset():
    reset_openai()
    return {"ok": True, "budget": openai_budget_status()}


@router.get("/sessions", dependencies=[Depends(require_admin)])
def sessions(limit: int = Query(50, le=200), offset: int = 0, q: str | None = None,
             include_empty: bool = False):
    where, args = [], []
    if not include_empty:
        where.append("user_message_count > 0")
    if q:
        where.append("(ip LIKE ? OR visitor_name LIKE ? OR visitor_company LIKE ? OR country LIKE ? OR city LIKE ? OR id LIKE ?)")
        args += [f"%{q}%"] * 6
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    with db.connect() as c:
        total = c.execute(f"SELECT COUNT(*) FROM sessions {clause}", args).fetchone()[0]
        rows = [dict(r) for r in c.execute(
            f"SELECT * FROM sessions {clause} ORDER BY started_at DESC LIMIT ? OFFSET ?",
            (*args, limit, offset)).fetchall()]
    for r in rows:
        r.pop("riddle_state", None)
    return {"total": total, "items": rows}


@router.get("/sessions/{session_id}", dependencies=[Depends(require_admin)])
def session_detail(session_id: str):
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Not found")
    with db.connect() as c:
        calls = [dict(r) for r in c.execute(
            "SELECT * FROM llm_calls WHERE session_id=? ORDER BY id", (session_id,)).fetchall()]
    return {"session": session, "messages": db.get_messages(session_id), "llm_calls": calls}


@router.get("/requests", dependencies=[Depends(require_admin)])
def requests_log(limit: int = Query(100, le=500), offset: int = 0, ip: str | None = None,
                 path: str | None = None, status: int | None = None):
    where, args = [], []
    if ip:
        where.append("ip LIKE ?")
        args.append(f"%{ip}%")
    if path:
        where.append("path LIKE ?")
        args.append(f"%{path}%")
    if status:
        where.append("status = ?")
        args.append(status)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    with db.connect() as c:
        total = c.execute(f"SELECT COUNT(*) FROM requests {clause}", args).fetchone()[0]
        rows = [dict(r) for r in c.execute(
            f"SELECT * FROM requests {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
            (*args, limit, offset)).fetchall()]
    return {"total": total, "items": rows}


@router.get("/llm-calls", dependencies=[Depends(require_admin)])
def llm_calls(limit: int = Query(100, le=500), offset: int = 0, provider: str | None = None):
    clause, args = ("WHERE provider=?", [provider]) if provider else ("", [])
    with db.connect() as c:
        total = c.execute(f"SELECT COUNT(*) FROM llm_calls {clause}", args).fetchone()[0]
        rows = [dict(r) for r in c.execute(
            f"SELECT * FROM llm_calls {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
            (*args, limit, offset)).fetchall()]
    return {"total": total, "items": rows}


LOG_NAME = re.compile(r"^app\.log(\.\d{4}-\d{2}-\d{2})?$")


@router.get("/logs", dependencies=[Depends(require_admin)])
def log_files():
    d = get_settings().log_dir
    files = sorted((p for p in d.glob("app.log*") if LOG_NAME.match(p.name)), reverse=True)
    return [{"name": p.name, "size": p.stat().st_size} for p in files]


@router.get("/logs/{name}", dependencies=[Depends(require_admin)])
def log_tail(name: str, lines: int = Query(300, le=5000)):
    if not LOG_NAME.match(name):
        raise HTTPException(400, "Bad log name")
    path = get_settings().log_dir / name
    if not path.exists():
        raise HTTPException(404, "Not found")
    with path.open(encoding="utf-8", errors="replace") as f:
        tail = deque(f, maxlen=lines)
    return {"name": name, "lines": list(tail)[::-1]}


# ---------------------------------------------------------------- settings (email / SMTP)

class EmailSettingsUpdate(BaseModel):
    enabled: bool | None = None
    notify_email: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    clear_password: bool = False
    from_name: str | None = None


@router.get("/settings", dependencies=[Depends(require_admin)])
def get_settings_view():
    return {"email": get_email_settings().public()}


@router.put("/settings/email", dependencies=[Depends(require_admin)])
def put_email_settings(body: EmailSettingsUpdate):
    if body.smtp_port is not None and not (1 <= body.smtp_port <= 65535):
        raise HTTPException(422, "SMTP port must be between 1 and 65535")
    if body.notify_email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", body.notify_email.strip()):
        raise HTTPException(422, "Recipient email looks invalid")
    data = body.model_dump()
    for k in ("notify_email", "smtp_host", "smtp_user", "from_name"):
        if isinstance(data.get(k), str):
            data[k] = data[k].strip()
    es = save_email_settings(data)
    log_event("admin", "email settings updated", enabled=es.enabled, host=es.smtp_host, user=es.smtp_user)
    return {"email": es.public()}


@router.post("/settings/email/test", dependencies=[Depends(require_admin)])
def test_email():
    try:
        send_test_email()
    except ValueError as ex:
        raise HTTPException(422, str(ex))
    except Exception as ex:
        raise HTTPException(502, f"Sending failed: {str(ex)[:300]}")
    return {"ok": True}


# ---------------------------------------------------------------- content editor

@router.get("/content", dependencies=[Depends(require_admin)])
def get_content_editor():
    return {"content": editable_payload(), "index": index_status()}


class SectionUpdate(BaseModel):
    data: Any


@router.put("/content/{section}", dependencies=[Depends(require_admin)])
def put_content_section(section: str, body: SectionUpdate):
    try:
        status = save_section(section, body.data)
    except KeyError:
        raise HTTPException(404, f"Unknown section '{section}'")
    except ValidationError as ex:
        msgs = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in ex.errors()[:8]]
        raise HTTPException(422, "; ".join(msgs))
    except ValueError as ex:
        raise HTTPException(422, str(ex))
    return {"ok": True, "index": status, "content": editable_payload()}


@router.post("/content/reindex", dependencies=[Depends(require_admin)])
def reindex():
    return {"ok": True, "index": ensure_index(force=True)}
