import threading
import time
from collections import defaultdict, deque

from fastapi import Request


def client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers behind nginx, so client.host is already the real IP.
    return request.client.host if request.client else "unknown"


class SlidingWindowLimiter:
    """In-memory per-key sliding window. Fine for a single-process deployment."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_s: int) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_s:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def count(self, key: str, window_s: int) -> int:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_s:
                q.popleft()
            return len(q)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


limiter = SlidingWindowLimiter()
