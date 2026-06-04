from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request

from app.api.deps import client_ip
from app.core.cache import cache


@dataclass(frozen=True)
class RateLimitRule:
    method: str
    prefix: str
    limit: int
    window_seconds: int


RULES = [
    RateLimitRule("POST", "/api/auth/login", 5, 60),
    RateLimitRule("POST", "/api/auth/register", 5, 60),
    RateLimitRule("POST", "/api/auth/forgot-password", 3, 3600),
    RateLimitRule("POST", "/api/auth/2fa/validate", 6, 60),
    RateLimitRule("POST", "/api/auth/2fa", 3, 60),
    RateLimitRule("POST", "/api/bookings", 30, 60),
    RateLimitRule("GET", "/api/properties", 100, 60),
    RateLimitRule("POST", "/api/uploads", 20, 3600),
    RateLimitRule("POST", "/api/admin", 20, 60),
    RateLimitRule("PATCH", "/api/admin", 20, 60),
    RateLimitRule("DELETE", "/api/admin", 10, 60),
]


def _device_key(request: Request) -> str:
    return request.headers.get("x-device-id") or request.headers.get("user-agent", "unknown")[:80]


def check_rate_limit(request: Request) -> tuple[bool, int, int]:
    path = request.url.path
    method = request.method.upper()
    rule = next((item for item in RULES if item.method == method and path.startswith(item.prefix)), None)
    if not rule:
        return True, 0, 0
    subject = "anonymous"
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        subject = auth_header[-16:]
    key = f"rate:{method}:{rule.prefix}:{client_ip(request)}:{subject}:{_device_key(request)}"
    count = cache.increment_window(key, rule.window_seconds)
    return count <= rule.limit, rule.limit, rule.window_seconds
