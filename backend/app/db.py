"""Tiny SQLite layer. One short-lived connection per operation keeps it thread-safe
for FastAPI's threadpool; WAL mode keeps readers and the writer from blocking each other."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    ip TEXT,
    user_agent TEXT,
    city TEXT, region TEXT, country TEXT,
    visitor_name TEXT, visitor_relation TEXT, visitor_company TEXT, visitor_email TEXT,
    visitor_declined INTEGER DEFAULT 0,
    riddle_state TEXT DEFAULT '{}',
    started_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    end_requested_at TEXT,
    ended_at TEXT,
    emailed_at TEXT,
    user_message_count INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    last_provider TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_started ON sessions(started_at);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    cards TEXT DEFAULT '[]',
    suggestions TEXT DEFAULT '[]',
    provider TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_messages_session ON messages(session_id, id);

CREATE TABLE IF NOT EXISTS llm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT, ip TEXT,
    provider TEXT, model TEXT,
    prompt_tokens INTEGER DEFAULT 0, completion_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0, latency_ms INTEGER,
    status TEXT, error TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_llm_calls_created ON llm_calls(created_at);
CREATE INDEX IF NOT EXISTS ix_llm_calls_session ON llm_calls(session_id);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL, ip TEXT, method TEXT, path TEXT,
    status INTEGER, latency_ms INTEGER, session_id TEXT
);
CREATE INDEX IF NOT EXISTS ix_requests_ts ON requests(ts);

CREATE TABLE IF NOT EXISTS geo_cache (
    ip TEXT PRIMARY KEY, city TEXT, region TEXT, country TEXT, fetched_at TEXT
);

CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
"""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ts(dt: datetime | None = None) -> str:
    return (dt or utcnow()).strftime("%Y-%m-%dT%H:%M:%S")


def ts_ago(**kwargs) -> str:
    return ts(utcnow() - timedelta(**kwargs))


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    s = get_settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(s.data_dir / "watson.sqlite3", timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


MIGRATIONS = [
    # (table, column, ddl): additive columns for databases created by older versions
    ("sessions", "email_status", "ALTER TABLE sessions ADD COLUMN email_status TEXT"),
]


def init_db() -> None:
    with connect() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)
        for table, column, ddl in MIGRATIONS:
            cols = {r[1] for r in c.execute(f"PRAGMA table_info({table})")}
            if column not in cols:
                c.execute(ddl)


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


# ---------------------------------------------------------------- sessions

def create_session(session_id: str, ip: str, user_agent: str) -> None:
    now = ts()
    with connect() as c:
        c.execute(
            "INSERT OR IGNORE INTO sessions (id, ip, user_agent, started_at, last_active_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (session_id, ip, user_agent[:400], now, now),
        )


def get_session(session_id: str) -> dict | None:
    with connect() as c:
        return row_to_dict(c.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone())


def update_session(session_id: str, **fields) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with connect() as c:
        c.execute(f"UPDATE sessions SET {cols} WHERE id=?", (*fields.values(), session_id))


def touch_session(session_id: str, provider: str | None, cost: float) -> None:
    with connect() as c:
        c.execute(
            "UPDATE sessions SET last_active_at=?, user_message_count=user_message_count+1, "
            "cost_usd=cost_usd+?, last_provider=COALESCE(?, last_provider) WHERE id=?",
            (ts(), cost, provider, session_id),
        )


def idle_sessions_to_close(idle_minutes: int, closed_grace_minutes: int = 2) -> list[dict]:
    """Sessions idle too long, or whose tab was closed (beacon) and that haven't come back."""
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM sessions WHERE ended_at IS NULL AND ("
            "  last_active_at < ? OR (end_requested_at IS NOT NULL AND end_requested_at < ?))",
            (ts_ago(minutes=idle_minutes), ts_ago(minutes=closed_grace_minutes)),
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------- messages

def add_message(session_id: str, role: str, content: str, cards=None, suggestions=None,
                provider: str | None = None) -> None:
    with connect() as c:
        c.execute(
            "INSERT INTO messages (session_id, role, content, cards, suggestions, provider, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, role, content, json.dumps(cards or []), json.dumps(suggestions or []),
             provider, ts()),
        )


def get_messages(session_id: str, limit: int | None = None) -> list[dict]:
    with connect() as c:
        if limit:
            rows = c.execute(
                "SELECT * FROM (SELECT * FROM messages WHERE session_id=? ORDER BY id DESC LIMIT ?) "
                "ORDER BY id ASC",
                (session_id, limit),
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT * FROM messages WHERE session_id=? ORDER BY id ASC", (session_id,)
            ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["cards"] = json.loads(d["cards"] or "[]")
        d["suggestions"] = json.loads(d["suggestions"] or "[]")
        out.append(d)
    return out


# ---------------------------------------------------------------- llm calls / spend

def add_llm_call(**fields) -> None:
    fields.setdefault("created_at", ts())
    cols = ", ".join(fields)
    qs = ", ".join("?" for _ in fields)
    with connect() as c:
        c.execute(f"INSERT INTO llm_calls ({cols}) VALUES ({qs})", tuple(fields.values()))


def provider_spend(provider: str, *, session_id: str | None = None, ip: str | None = None,
                   since: str | None = None) -> float:
    q = "SELECT COALESCE(SUM(cost_usd), 0) FROM llm_calls WHERE provider=?"
    args: list[Any] = [provider]
    if session_id:
        q += " AND session_id=?"
        args.append(session_id)
    if ip:
        q += " AND ip=?"
        args.append(ip)
    if since:
        q += " AND created_at>=?"
        args.append(since)
    with connect() as c:
        return float(c.execute(q, args).fetchone()[0])


# ---------------------------------------------------------------- request log

def add_request(**fields) -> None:
    cols = ", ".join(fields)
    qs = ", ".join("?" for _ in fields)
    with connect() as c:
        c.execute(f"INSERT INTO requests ({cols}) VALUES ({qs})", tuple(fields.values()))


def prune_requests(days: int) -> int:
    with connect() as c:
        return c.execute("DELETE FROM requests WHERE ts < ?", (ts_ago(days=days),)).rowcount


# ---------------------------------------------------------------- kv + geo cache

def kv_get(key: str, default: str | None = None) -> str | None:
    with connect() as c:
        row = c.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def kv_set(key: str, value: str | None) -> None:
    with connect() as c:
        if value is None:
            c.execute("DELETE FROM kv WHERE key=?", (key,))
        else:
            c.execute("INSERT INTO kv (key, value) VALUES (?, ?) "
                      "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))


def geo_get(ip: str) -> dict | None:
    with connect() as c:
        return row_to_dict(c.execute("SELECT * FROM geo_cache WHERE ip=?", (ip,)).fetchone())


def geo_set(ip: str, city: str | None, region: str | None, country: str | None) -> None:
    with connect() as c:
        c.execute("INSERT OR REPLACE INTO geo_cache (ip, city, region, country, fetched_at) "
                  "VALUES (?, ?, ?, ?, ?)", (ip, city, region, country, ts()))
