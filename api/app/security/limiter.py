"""In-memory sliding-window rate limiter (LEAN §1.2: login + pairing only)."""
import threading
import time


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: int) -> tuple[bool, int]:
        """Peek without recording: is another attempt under the limit allowed?"""
        now = time.monotonic()
        with self._lock:
            bucket = [t for t in self._hits.get(key, []) if now - t < window_s]
            self._hits[key] = bucket
            if len(bucket) >= limit:
                retry_after = max(int(window_s - (now - bucket[0])) + 1, 1)
                return False, retry_after
            return True, 0

    def hit(self, key: str, limit: int, window_s: int) -> tuple[bool, int]:
        """Record one attempt. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            bucket = [t for t in self._hits.get(key, []) if now - t < window_s]
            if len(bucket) >= limit:
                retry_after = max(int(window_s - (now - bucket[0])) + 1, 1)
                self._hits[key] = bucket
                return False, retry_after
            bucket.append(now)
            self._hits[key] = bucket
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()
