"""Runtime settings editable from the admin dashboard, stored in SQLite (kv table).
Anything not set in the dashboard falls back to the .env value."""

import json
from dataclasses import asdict, dataclass

from . import db
from .config import get_settings

KEY = "settings:email"


@dataclass
class EmailSettings:
    enabled: bool
    notify_email: str
    smtp_host: str
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    from_name: str

    @property
    def configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password and self.notify_email)

    def public(self) -> dict:
        """Safe to send to the browser: the password itself never leaves the server."""
        d = asdict(self)
        d.pop("smtp_password")
        d["password_set"] = bool(self.smtp_password)
        d["configured"] = self.configured
        return d


def _stored() -> dict:
    try:
        return json.loads(db.kv_get(KEY) or "{}")
    except json.JSONDecodeError:
        return {}


def get_email_settings() -> EmailSettings:
    s = get_settings()
    o = _stored()
    return EmailSettings(
        enabled=o.get("enabled", True),
        notify_email=o.get("notify_email") or s.notify_email,
        smtp_host=o.get("smtp_host") or s.smtp_host,
        smtp_port=int(o.get("smtp_port") or s.smtp_port),
        smtp_user=o.get("smtp_user") or s.smtp_user,
        smtp_password=o.get("smtp_password") or s.smtp_app_password,
        from_name=o.get("from_name") or "Watson",
    )


def save_email_settings(update: dict) -> EmailSettings:
    """Merge an update from the dashboard. An empty/missing password keeps the current one;
    `clear_password=True` removes the stored one (falls back to .env)."""
    stored = _stored()
    for k in ("enabled", "notify_email", "smtp_host", "smtp_port", "smtp_user", "from_name"):
        if k in update and update[k] is not None:
            stored[k] = update[k]
    if update.get("smtp_password"):
        stored["smtp_password"] = update["smtp_password"]
    if update.get("clear_password"):
        stored.pop("smtp_password", None)
    db.kv_set(KEY, json.dumps(stored))
    return get_email_settings()
