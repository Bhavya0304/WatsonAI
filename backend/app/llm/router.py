"""Budget-aware fallback: OpenAI (paid, capped) → Gemini (free) → Groq (free) → give up politely."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import lru_cache

from .. import db
from ..config import get_settings
from ..logging_setup import log_event
from .pricing import cost_usd
from .provider import Provider, ProviderError, build_providers

COOLDOWN_SECONDS = {"rate_limit": 60, "transient": 20, "auth": 3600}


@dataclass
class RouteResult:
    text: str | None
    provider: str | None
    model: str | None
    cost: float = 0.0
    skipped: list[str] = field(default_factory=list)


@lru_cache
def providers() -> list[Provider]:
    return build_providers()


# ---------------------------------------------------------------- state helpers

def _cooldown_key(name: str) -> str:
    return f"cooldown:{name}"


def set_cooldown(name: str, until: datetime) -> None:
    db.kv_set(_cooldown_key(name), db.ts(until))


def in_cooldown(name: str) -> str | None:
    until = db.kv_get(_cooldown_key(name))
    return until if until and until > db.ts() else None


def next_pacific_midnight() -> datetime:
    """Gemini free-tier daily quotas reset at midnight Pacific (07:00 or 08:00 UTC).
    Using 08:05 UTC covers both PST and PDT without needing tzdata on Windows."""
    now = db.utcnow()
    nxt = now.replace(hour=8, minute=5, second=0, microsecond=0)
    return nxt if nxt > now else nxt + timedelta(days=1)


def openai_baseline() -> str:
    """Lifetime spend counts from the last dashboard reset (e.g. after a top-up)."""
    return db.kv_get("openai_baseline_at", "1970-01-01T00:00:00")


def month_start() -> str:
    now = db.utcnow()
    return db.ts(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))


def openai_budget_status(session_id: str | None = None, ip: str | None = None) -> dict:
    s = get_settings()
    base = openai_baseline()
    lifetime = db.provider_spend("openai", since=base)
    month = db.provider_spend("openai", since=max(base, month_start()))
    status = {
        "configured": bool(s.openai_api_key),
        "disabled_reason": db.kv_get("openai_disabled"),
        "lifetime_spend": round(lifetime, 4),
        "lifetime_cap": s.openai_lifetime_cap,
        "month_spend": round(month, 4),
        "month_cap": s.openai_monthly_cap,
        "remaining": round(max(0.0, s.openai_lifetime_cap - lifetime), 4),
    }
    if session_id:
        status["session_spend"] = db.provider_spend("openai", session_id=session_id)
    if ip:
        status["ip_day_spend"] = db.provider_spend("openai", ip=ip, since=db.ts_ago(days=1))
    return status


def openai_block_reason(session_id: str, ip: str) -> str | None:
    s = get_settings()
    st = openai_budget_status(session_id, ip)
    if st["disabled_reason"]:
        return f"disabled ({st['disabled_reason']})"
    if st["lifetime_spend"] >= s.openai_lifetime_cap:
        return "lifetime cap reached"
    if st["month_spend"] >= s.openai_monthly_cap:
        return "monthly cap reached"
    if st["session_spend"] >= s.openai_session_cap:
        return "session cap reached"
    if st["ip_day_spend"] >= s.openai_ip_daily_cap:
        return "ip daily cap reached"
    return None


def reset_openai() -> None:
    db.kv_set("openai_disabled", None)
    db.kv_set("openai_baseline_at", db.ts())
    db.kv_set(_cooldown_key("openai"), None)


# ---------------------------------------------------------------- routing

def _apply_failure(p: Provider, err: ProviderError) -> None:
    if p.name == "openai" and err.kind == "quota":
        db.kv_set("openai_disabled", "prepaid credit exhausted")
    elif err.kind in ("daily_limit", "quota"):
        set_cooldown(p.name, next_pacific_midnight())
    else:
        set_cooldown(p.name, db.utcnow() + timedelta(seconds=COOLDOWN_SECONDS.get(err.kind, 30)))


def complete(messages: list[dict], session_id: str, ip: str) -> RouteResult:
    skipped: list[str] = []
    for p in providers():
        if not p.configured:
            skipped.append(f"{p.name}: no api key")
            continue
        if until := in_cooldown(p.name):
            skipped.append(f"{p.name}: cooling down until {until}")
            continue
        if p.name == "openai" and (why := openai_block_reason(session_id, ip)):
            skipped.append(f"openai: {why}")
            continue
        try:
            out = p.chat(messages)
        except ProviderError as err:
            _apply_failure(p, err)
            skipped.append(f"{p.name}: {err.kind}")
            db.add_llm_call(session_id=session_id, ip=ip, provider=p.name, model=p.model,
                            status="error", error=f"{err.kind}: {str(err)[:500]}")
            log_event("llm", "llm call failed", session_id=session_id, ip=ip, provider=p.name,
                      model=p.model, kind=err.kind, error=str(err)[:300])
            continue

        cost = cost_usd(p.name, p.model, out.prompt_tokens, out.completion_tokens)
        db.add_llm_call(session_id=session_id, ip=ip, provider=p.name, model=p.model,
                        prompt_tokens=out.prompt_tokens, completion_tokens=out.completion_tokens,
                        cost_usd=cost, latency_ms=out.latency_ms, status="ok")
        log_event("llm", "llm call ok", session_id=session_id, ip=ip, provider=p.name, model=p.model,
                  prompt_tokens=out.prompt_tokens, completion_tokens=out.completion_tokens,
                  cost_usd=round(cost, 6), latency_ms=out.latency_ms, fallback=skipped)
        return RouteResult(out.text, p.name, p.model, cost, skipped)

    log_event("llm", "all providers exhausted", session_id=session_id, ip=ip, skipped=skipped)
    return RouteResult(None, None, None, 0.0, skipped)


def provider_states() -> list[dict]:
    out = []
    for p in providers():
        out.append({"name": p.name, "model": p.model, "configured": p.configured,
                    "cooldown_until": in_cooldown(p.name)})
    return out
