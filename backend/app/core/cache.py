from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

import redis

from app.core.config import settings


@dataclass
class MemoryEntry:
    value: str
    expires_at: float | None


class CacheService:
    def __init__(self) -> None:
        self._memory: dict[str, MemoryEntry] = {}
        try:
            self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.25)
            self._redis.ping()
        except Exception:
            self._redis = None

    def _expired(self, entry: MemoryEntry) -> bool:
        return entry.expires_at is not None and entry.expires_at < time.time()

    def get(self, key: str) -> str | None:
        if self._redis:
            return self._redis.get(key)
        entry = self._memory.get(key)
        if not entry:
            return None
        if self._expired(entry):
            self._memory.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        if self._redis:
            self._redis.set(key, value, ex=ttl_seconds)
            return
        self._memory[key] = MemoryEntry(value=value, expires_at=time.time() + ttl_seconds if ttl_seconds else None)

    def get_json(self, key: str) -> Any | None:
        raw = self.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        self.set(key, json.dumps(value, default=str), ttl_seconds)

    def delete(self, key: str) -> None:
        if self._redis:
            self._redis.delete(key)
            return
        self._memory.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        if self._redis:
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(cursor=cursor, match=f"{prefix}*", count=250)
                if keys:
                    self._redis.delete(*keys)
                if cursor == 0:
                    break
            return
        for key in list(self._memory):
            if key.startswith(prefix):
                self._memory.pop(key, None)

    def increment_window(self, key: str, window_seconds: int) -> int:
        if self._redis:
            value = self._redis.incr(key)
            if value == 1:
                self._redis.expire(key, window_seconds)
            return int(value)
        value = int(self.get(key) or "0") + 1
        self.set(key, str(value), window_seconds)
        return value

    def blacklist_jti(self, jti: str, ttl_seconds: int) -> None:
        self.set(f"jwt:blacklist:{jti}", "1", ttl_seconds)

    def is_blacklisted(self, jti: str) -> bool:
        return self.get(f"jwt:blacklist:{jti}") == "1"


cache = CacheService()

