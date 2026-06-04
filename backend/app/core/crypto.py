from __future__ import annotations

import base64
import os
from hashlib import sha256

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

PREFIX = "enc:v1:"


def _key() -> bytes:
    raw = settings.field_encryption_key
    if not raw:
        if settings.environment == "production":
            raise ValueError("UBOOK_FIELD_ENCRYPTION_KEY is required in production")
        raw = settings.secret_key
    try:
        decoded = base64.urlsafe_b64decode(raw)
        if len(decoded) in {16, 24, 32}:
            return decoded
    except Exception:
        pass
    return sha256(raw.encode("utf-8")).digest()


def encrypt_text(value: str | None) -> str | None:
    if value is None or value.startswith(PREFIX):
        return value
    nonce = os.urandom(12)
    ciphertext = AESGCM(_key()).encrypt(nonce, value.encode("utf-8"), None)
    return PREFIX + base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_text(value: str | None) -> str | None:
    if value is None or not value.startswith(PREFIX):
        return value
    raw = base64.urlsafe_b64decode(value.removeprefix(PREFIX))
    nonce, ciphertext = raw[:12], raw[12:]
    return AESGCM(_key()).decrypt(nonce, ciphertext, None).decode("utf-8")
