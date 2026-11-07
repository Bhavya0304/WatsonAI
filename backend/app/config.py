from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Paths ---
    content_dir: Path = ROOT_DIR / "content"
    data_dir: Path = ROOT_DIR / "db"
    log_dir: Path = ROOT_DIR / "logs"

    # --- LLM providers ---
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    llm_temperature: float = 0.9
    llm_max_tokens: int = 900
    llm_timeout_s: float = 40.0

    # --- OpenAI budget guards (USD) ---
    openai_session_cap: float = 0.10
    openai_ip_daily_cap: float = 0.20
    openai_monthly_cap: float = 2.00
    openai_lifetime_cap: float = 14.00

    # --- Abuse / rate limits ---
    rate_limit_messages: int = 15
    rate_limit_window_s: int = 300
    max_message_chars: int = 800
    max_messages_per_session: int = 80

    # --- Agent ---
    history_messages: int = 12
    rag_top_k: int = 4
    riddle_max_attempts: int = 3

    # --- Sessions / email ---
    session_idle_minutes: int = 30
    reaper_interval_s: int = 60
    notify_email: str = "jshi.bhavya@gmail.com"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_app_password: str | None = None

    # --- Logging ---
    log_retention_days: int = 30
    log_rotate_when: str = "midnight"

    # --- Admin ---
    admin_username: str = "admin"
    admin_password: str = "change-me"
    secret_key: str = "dev-secret-change-me"
    admin_max_failed_logins: int = 5
    admin_lockout_minutes: int = 15

    # --- Geo ---
    geo_enabled: bool = True

    # --- CORS (dev only; prod is same-origin behind nginx) ---
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cookie_secure: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
