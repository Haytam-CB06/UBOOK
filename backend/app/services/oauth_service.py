from __future__ import annotations

import base64
import enum
import hashlib
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from jose import jwk, jwt

from app.core.config import settings


class OAuthProvider(str, enum.Enum):
    google = "google"
    microsoft = "microsoft"
    apple = "apple"


@dataclass(frozen=True)
class OAuthProviderConfig:
    provider: OAuthProvider
    client_id: str
    client_secret: str | None
    redirect_uri: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    issuer: str
    scope: str
    response_type: str = "code"
    extra_authorize_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class OAuthIdentity:
    provider: str
    subject: str
    email: str | None
    email_verified: bool
    full_name: str | None
    avatar_url: str | None
    provider_data: dict[str, Any]


def get_provider_config(provider: str | OAuthProvider) -> OAuthProviderConfig:
    normalized = OAuthProvider(provider)
    if normalized == OAuthProvider.google:
        if not settings.google_client_id or not settings.google_client_secret:
            raise ValueError("Google OAuth is not configured")
        return OAuthProviderConfig(
            provider=normalized,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            redirect_uri=settings.google_redirect_uri,
            authorization_endpoint="https://accounts.google.com/o/oauth2/v2/auth",
            token_endpoint="https://oauth2.googleapis.com/token",
            jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
            issuer="https://accounts.google.com",
            scope="openid email profile",
            extra_authorize_params=(("access_type", "offline"), ("include_granted_scopes", "true"), ("prompt", "select_account")),
        )
    if normalized == OAuthProvider.microsoft:
        if not settings.microsoft_client_id or not settings.microsoft_client_secret:
            raise ValueError("Microsoft OAuth is not configured")
        tenant = settings.microsoft_tenant_id or "common"
        discovery_root = f"https://login.microsoftonline.com/{tenant}/v2.0"
        return OAuthProviderConfig(
            provider=normalized,
            client_id=settings.microsoft_client_id,
            client_secret=settings.microsoft_client_secret,
            redirect_uri=settings.microsoft_redirect_uri,
            authorization_endpoint=f"{discovery_root}/oauth2/v2.0/authorize",
            token_endpoint=f"{discovery_root}/oauth2/v2.0/token",
            jwks_uri=f"{discovery_root}/discovery/v2.0/keys",
            issuer=f"{discovery_root}",
            scope="openid email profile offline_access",
            extra_authorize_params=(("prompt", "select_account"),),
        )
    if not settings.apple_client_id or not settings.apple_team_id or not settings.apple_key_id or not settings.apple_private_key:
        raise ValueError("Apple OAuth is not configured")
    return OAuthProviderConfig(
        provider=normalized,
        client_id=settings.apple_client_id,
        client_secret=None,
        redirect_uri=settings.apple_redirect_uri,
        authorization_endpoint="https://appleid.apple.com/auth/authorize",
        token_endpoint="https://appleid.apple.com/auth/token",
        jwks_uri="https://appleid.apple.com/auth/keys",
        issuer="https://appleid.apple.com",
        scope="openid email name",
        response_type="code id_token",
        extra_authorize_params=(("response_mode", "form_post"),),
    )


def generate_pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    return secrets.token_urlsafe(32)


def _http_json_request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: bytes | None = None
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    if data is not None:
        request_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
        payload = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(body or f"HTTP {exc.code} from {url}") from exc
    except Exception as exc:
        raise RuntimeError(f"Unable to reach OAuth provider endpoint: {url}") from exc


@lru_cache(maxsize=8)
def get_provider_metadata(provider: str | OAuthProvider) -> dict[str, Any]:
    config = get_provider_config(provider)
    if config.provider == OAuthProvider.google:
        discovery = "https://accounts.google.com/.well-known/openid-configuration"
    elif config.provider == OAuthProvider.microsoft:
        discovery = f"https://login.microsoftonline.com/{settings.microsoft_tenant_id or 'common'}/v2.0/.well-known/openid-configuration"
    else:
        discovery = "https://appleid.apple.com/.well-known/openid-configuration"
    return _http_json_request(discovery)


def build_authorize_url(*, provider: str | OAuthProvider, state: str, nonce: str, code_verifier: str) -> str:
    config = get_provider_config(provider)
    metadata = get_provider_metadata(config.provider)
    params: list[tuple[str, str]] = [
        ("client_id", config.client_id),
        ("redirect_uri", config.redirect_uri),
        ("response_type", config.response_type),
        ("scope", config.scope),
        ("state", state),
        ("nonce", nonce),
        ("code_challenge", pkce_challenge(code_verifier)),
        ("code_challenge_method", "S256"),
    ]
    params.extend(config.extra_authorize_params)
    return f"{metadata['authorization_endpoint']}?{urllib.parse.urlencode(params)}"


def _apple_client_secret() -> str:
    import datetime

    config = get_provider_config(OAuthProvider.apple)
    private_key = settings.apple_private_key.replace("\\n", "\n").strip()
    now = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    payload = {
        "iss": settings.apple_team_id,
        "iat": now,
        "exp": now + 15552000,
        "aud": "https://appleid.apple.com",
        "sub": config.client_id,
    }
    headers = {"kid": settings.apple_key_id, "alg": "ES256"}
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def exchange_code_for_tokens(*, provider: str | OAuthProvider, code: str, code_verifier: str) -> dict[str, Any]:
    config = get_provider_config(provider)
    metadata = get_provider_metadata(config.provider)
    payload: dict[str, Any] = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": config.redirect_uri,
        "client_id": config.client_id,
        "code_verifier": code_verifier,
    }
    if config.provider == OAuthProvider.apple:
        payload["client_secret"] = _apple_client_secret()
    else:
        payload["client_secret"] = config.client_secret or ""
    return _http_json_request(metadata["token_endpoint"], method="POST", data=payload)


def _coerce_verified(value: Any, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def verify_and_normalize_identity(
    *,
    provider: str | OAuthProvider,
    id_token: str,
    nonce: str,
    access_token: str | None = None,
) -> OAuthIdentity:
    config = get_provider_config(provider)
    metadata = get_provider_metadata(config.provider)
    header = jwt.get_unverified_header(id_token)
    jwks = _http_json_request(metadata["jwks_uri"])
    key_data = next((key for key in jwks.get("keys", []) if key.get("kid") == header.get("kid")), None)
    if not key_data and jwks.get("keys"):
        key_data = jwks["keys"][0]
    if not key_data:
        raise RuntimeError("Unable to verify OAuth identity token")
    algorithm = header.get("alg") or "RS256"
    public_key = jwk.construct(key_data, algorithm=algorithm).to_pem()
    claims = jwt.decode(
        id_token,
        public_key,
        algorithms=[algorithm],
        audience=config.client_id,
        issuer=metadata.get("issuer") or config.issuer,
        access_token=access_token,
    )
    if claims.get("nonce") and claims.get("nonce") != nonce:
        raise RuntimeError("OAuth nonce mismatch")
    if config.provider == OAuthProvider.google:
        email = claims.get("email")
        email_verified = _coerce_verified(claims.get("email_verified"))
    elif config.provider == OAuthProvider.microsoft:
        email = claims.get("email") or claims.get("preferred_username")
        email_verified = _coerce_verified(claims.get("email_verified"), default=True)
    else:
        email = claims.get("email")
        email_verified = True if email else False
    if not email:
        raise RuntimeError("OAuth provider did not return an email address")
    if not email_verified:
        raise RuntimeError("OAuth provider email is not verified")
    full_name = claims.get("name") or " ".join(part for part in [claims.get("given_name"), claims.get("family_name")] if part).strip() or None
    avatar_url = claims.get("picture") or None
    return OAuthIdentity(
        provider=config.provider.value,
        subject=str(claims["sub"]),
        email=str(email).lower(),
        email_verified=True,
        full_name=full_name,
        avatar_url=avatar_url,
        provider_data=dict(claims),
    )
