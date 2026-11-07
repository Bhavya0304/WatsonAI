import json
import logging
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler

from .config import get_settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "data", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging() -> None:
    s = get_settings()
    s.log_dir.mkdir(parents=True, exist_ok=True)

    file_handler = TimedRotatingFileHandler(
        s.log_dir / "app.log",
        when=s.log_rotate_when,
        backupCount=s.log_retention_days,
        encoding="utf-8",
        utc=True,
    )
    file_handler.setFormatter(JsonFormatter())

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

    root = logging.getLogger("watson")
    root.setLevel(logging.INFO)
    root.handlers = [file_handler, console]
    root.propagate = False


def log_event(logger_name: str, msg: str, **data) -> None:
    logging.getLogger(f"watson.{logger_name}").info(msg, extra={"data": data})
