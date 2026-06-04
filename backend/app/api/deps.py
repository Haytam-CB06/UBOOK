from __future__ import annotations

from collections.abc import Callable
from datetime import timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.security import decode_token, now_utc
from app.models import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else request.cookies.get("ubook_access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_token(token, expected_type="access")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if cache.is_blacklisted(payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    user = db.get(User, int(payload["sub"]))
    if not user or user.deleted_at or not user.is_active or user.suspended_at or user.banned_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    locked_until = user.locked_until
    if locked_until and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if user.is_locked and locked_until and locked_until > now_utc():
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account locked")
    return user


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials and not request.cookies.get("ubook_access_token"):
        return None
    return get_current_user(request, credentials, db)


def require_roles(*roles: Role) -> Callable[[User], User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles and user.role != Role.super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def require_mfa(request: Request, user: User = Depends(get_current_user), credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> User:
    token = credentials.credentials if credentials else request.cookies.get("ubook_access_token")
    try:
        payload = decode_token(token, expected_type="access")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if "mfa" not in payload.get("amr", []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="MFA verification required")
    return user


def require_roles_mfa(*roles: Role) -> Callable[[User], User]:
    def dependency(user: User = Depends(require_mfa)) -> User:
        if user.role not in roles and user.role != Role.super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def seconds_until(exp_timestamp: int) -> int:
    return max(1, int(exp_timestamp - now_utc().replace(tzinfo=timezone.utc).timestamp()))
