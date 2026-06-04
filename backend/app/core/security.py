from __future__ import annotations

import base64
import hashlib
import io
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import pyotp
import qrcode
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated=["bcrypt"],
    argon2__type="ID",
    argon2__memory_cost=65536,
    argon2__time_cost=3,
    argon2__parallelism=4,
)
ALGORITHM = "HS256"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def password_needs_rehash(password_hash: str) -> bool:
    return pwd_context.needs_update(password_hash)


def enforce_password_policy(password: str) -> None:
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")
    checks = [
        any(char.islower() for char in password),
        any(char.isupper() for char in password),
        any(char.isdigit() for char in password),
        any(not char.isalnum() for char in password),
    ]
    if sum(checks) < 3:
        raise ValueError("Password must include at least three of lowercase, uppercase, number, and symbol")


def _create_token(
    *,
    subject: str,
    token_type: Literal["access", "refresh", "2fa_temp", "password_reset"],
    secret: str,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, str, datetime]:
    expires_at = now_utc() + expires_delta
    jti = secrets.token_urlsafe(24)
    payload: dict[str, Any] = {
        "sub": subject,
        "iss": settings.issuer,
        "aud": settings.jwt_audience,
        "type": token_type,
        "jti": jti,
        "iat": int(now_utc().timestamp()),
        "exp": expires_at,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm=ALGORITHM), jti, expires_at


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> tuple[str, str, datetime]:
    return _create_token(
        subject=subject,
        token_type="access",
        secret=settings.secret_key,
        expires_delta=timedelta(minutes=settings.access_token_minutes),
        extra_claims=extra_claims,
    )


def create_refresh_token(subject: str, extra_claims: dict[str, Any] | None = None) -> tuple[str, str, datetime]:
    return _create_token(
        subject=subject,
        token_type="refresh",
        secret=settings.refresh_secret_key,
        expires_delta=timedelta(days=settings.refresh_token_days),
        extra_claims=extra_claims,
    )


def create_temp_2fa_token(subject: str) -> tuple[str, str, datetime]:
    return _create_token(
        subject=subject,
        token_type="2fa_temp",
        secret=settings.secret_key,
        expires_delta=timedelta(minutes=settings.temp_token_minutes),
    )


def create_password_reset_token(subject: str) -> tuple[str, str, datetime]:
    return _create_token(
        subject=subject,
        token_type="password_reset",
        secret=settings.secret_key,
        expires_delta=timedelta(minutes=settings.password_reset_minutes),
    )


def decode_token(token: str, *, expected_type: str, refresh: bool = False) -> dict[str, Any]:
    secret = settings.refresh_secret_key if refresh else settings.secret_key
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM], issuer=settings.issuer, audience=settings.jwt_audience)
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload


def new_otp_secret() -> str:
    return pyotp.random_base32()


def otp_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name="UBOOK")


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def qr_code_data_url(uri: str) -> str:
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def generate_recovery_codes(count: int = 10) -> list[str]:
    return ["-".join([secrets.token_hex(2), secrets.token_hex(2), secrets.token_hex(2)]).upper() for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    normalized = code.replace(" ", "").upper().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()
