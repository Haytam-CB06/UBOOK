from __future__ import annotations

import logging
import secrets
from datetime import timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import bearer_scheme, client_ip, get_current_user, seconds_until
from app.core.cache import cache
from app.core.config import settings
from app.core.crypto import decrypt_text
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    create_temp_2fa_token,
    decode_token,
    enforce_password_policy,
    generate_recovery_codes,
    hash_password,
    password_needs_rehash,
    hash_recovery_code,
    new_otp_secret,
    now_utc,
    otp_uri,
    qr_code_data_url,
    verify_password,
    verify_totp,
)
from app.models import HostProfile, Role, TravelerProfile, User, UserOAuthIdentity, UserSession
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    OAuthSessionRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TwoFactorDisableRequest,
    TwoFactorValidateRequest,
    TwoFactorVerifySetupRequest,
)
from app.services.audit_service import audit
from app.services.notification_service import create_notification, password_reset
from app.services.oauth_service import (
    OAuthProvider,
    build_authorize_url,
    exchange_code_for_tokens,
    generate_nonce,
    generate_oauth_state,
    generate_pkce_verifier,
    get_provider_config,
    verify_and_normalize_identity,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _frontend_role(role: Role) -> str:
    if role == Role.hotel_admin:
        return "Host"
    if role in {Role.admin, Role.super_admin}:
        return "Admin"
    return "Traveler"


def _frontend_route_for_user(user: User) -> str:
    if user.role == Role.hotel_admin:
        if user.host_profile and user.host_profile.onboarding_completed_at:
            return "/host"
        return "/host/onboarding"
    if user.role in {Role.admin, Role.super_admin}:
        return "/admin"
    return "/dashboard"


def _allowed_frontend_origins() -> set[str]:
    origins = set(settings.frontend_url_list)
    origins.update(settings.oauth_javascript_origin_list)
    return {origin.rstrip("/") for origin in origins if origin}


def _frontend_origin_from_request(request: Request) -> str:
    candidates = [request.headers.get("origin"), request.headers.get("referer")]
    allowed = _allowed_frontend_origins()
    for candidate in candidates:
        if not candidate:
            continue
        parsed = urlparse(candidate)
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        if origin in allowed:
            return origin
    return settings.primary_frontend_url.rstrip("/")


def _login_redirect_url(error: str | None = None, temp_token: str | None = None, frontend_origin: str | None = None) -> str:
    from urllib.parse import urlencode

    base = f"{(frontend_origin or settings.primary_frontend_url).rstrip('/')}/login"
    query: dict[str, str] = {}
    if error:
        query["oauthError"] = error
    if temp_token:
        query["tempToken"] = temp_token
    return f"{base}?{urlencode(query)}" if query else base


def _workspace_redirect_url(user: User, frontend_origin: str | None = None) -> str:
    return f"{(frontend_origin or settings.primary_frontend_url).rstrip('/')}{_frontend_route_for_user(user)}"


def _oauth_callback_redirect_url(user: User, session_code: str, frontend_origin: str | None = None) -> str:
    from urllib.parse import urlencode

    base = f"{(frontend_origin or settings.primary_frontend_url).rstrip('/')}/oauth/callback"
    return f"{base}?{urlencode({'code': session_code, 'redirectTo': _frontend_route_for_user(user)})}"


def _oauth_error_message(exc: Exception) -> str:
    if settings.environment in {"development", "test"}:
        detail = str(exc).strip()
        if detail:
            return detail[:240]
    return "oauth_login_failed"


def _oauth_provider_availability() -> dict[str, bool]:
    availability: dict[str, bool] = {}
    for provider in OAuthProvider:
        try:
            get_provider_config(provider)
            availability[provider.value] = True
        except ValueError:
            availability[provider.value] = False
    return availability


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "full_name": user.full_name,
        "name": user.full_name,
        "role": _frontend_role(user.role),
        "rawRole": user.role.value,
        "otpEnabled": user.otp_enabled,
        "otp_enabled": user.otp_enabled,
        "otpVerified": user.otp_verified,
        "otp_verified": user.otp_verified,
        "twoFactorRequired": not user.otp_enabled,
        "two_factor_required": not user.otp_enabled,
        "securitySetupRequired": not user.otp_enabled,
        "security_setup_required": not user.otp_enabled,
        "avatarUrl": user.avatar_url,
        "phone": decrypt_text(user.phone),
        "emailVerified": user.email_verified,
        "phoneVerified": user.phone_verified,
        "identityVerified": user.identity_verified,
        "linkedProviders": sorted({account.provider for account in user.oauth_accounts}),
        "requiresHostOnboarding": user.role == Role.hotel_admin and not (user.host_profile and user.host_profile.onboarding_completed_at),
    }


def _cookie_kwargs(max_age: int) -> dict:
    return {
        "httponly": True,
        "secure": settings.secure_cookies,
        "samesite": settings.auth_cookie_samesite,
        "max_age": max_age,
        "path": "/",
        "domain": settings.auth_cookie_domain,
    }


def _set_auth_cookies(response: Response, token_pair: dict) -> None:
    access_max_age = settings.access_token_minutes * 60
    refresh_max_age = settings.refresh_token_days * 24 * 60 * 60
    response.set_cookie("ubook_access_token", token_pair["accessToken"], **_cookie_kwargs(access_max_age))
    response.set_cookie("ubook_refresh_token", token_pair["refreshToken"], **_cookie_kwargs(refresh_max_age))
    csrf_kwargs = _cookie_kwargs(refresh_max_age)
    csrf_kwargs["httponly"] = False
    response.set_cookie("ubook_csrf_token", secrets.token_urlsafe(32), **csrf_kwargs)


def _clear_auth_cookies(response: Response) -> None:
    base = {"path": "/", "domain": settings.auth_cookie_domain}
    response.delete_cookie("ubook_access_token", **base)
    response.delete_cookie("ubook_refresh_token", **base)
    response.delete_cookie("ubook_csrf_token", **base)


def _device_fingerprint(request: Request) -> str:
    import hashlib

    raw = "|".join(
        [
            request.headers.get("user-agent", ""),
            request.headers.get("accept-language", ""),
            request.headers.get("sec-ch-ua-platform", ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _role_from_frontend(value: str) -> Role:
    normalized = value.strip().lower().replace(" ", "_")
    if normalized in {"property_owner", "hotel_admin", "host", "owner"}:
        return Role.hotel_admin
    if normalized in {"admin"}:
        return Role.admin
    if normalized in {"super_admin"}:
        return Role.super_admin
    if normalized in {"traveler", "guest"}:
        return Role.guest
    return Role.guest


def _issue_token_pair(db: Session, request: Request, user: User, *, mfa_verified: bool = False) -> dict:
    amr = ["pwd", "mfa"] if mfa_verified else ["pwd"]
    claims = {"role": user.role.value, "amr": amr, "device": _device_fingerprint(request)}
    access, access_jti, access_exp = create_access_token(str(user.id), claims)
    refresh, refresh_jti, refresh_exp = create_refresh_token(str(user.id), claims)
    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_jti=refresh_jti,
            user_agent=request.headers.get("user-agent"),
            ip_address=client_ip(request),
            expires_at=refresh_exp,
        )
    )
    audit(db, action="auth.token_issued", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    return {
        "accessToken": access,
        "access_token": access,
        "refreshToken": refresh,
        "refresh_token": refresh,
        "tokenType": "bearer",
        "token_type": "bearer",
        "expiresAt": access_exp,
        "expires_at": access_exp,
        "token": access,
        "user": _user_payload(user),
        "accessJti": access_jti,
    }


def _store_oauth_session(token_pair: dict) -> str:
    code = secrets.token_urlsafe(32)
    cache.set_json(f"oauth:session:{code}", token_pair, 120)
    return code


def _aware(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _oauth_identity_query(provider: str, subject: str):
    return (
        UserOAuthIdentity,
        provider,
        subject,
    )


def _find_user_by_oauth_identity(db: Session, provider: str, subject: str) -> User | None:
    identity = (
        db.query(User)
        .join(UserOAuthIdentity, UserOAuthIdentity.user_id == User.id)
        .filter(UserOAuthIdentity.provider == provider, UserOAuthIdentity.subject == subject, User.deleted_at.is_(None))
        .first()
    )
    return identity


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower(), User.deleted_at.is_(None)).first()


def _upsert_oauth_identity(user: User, identity: dict, db: Session) -> None:
    existing = next((account for account in user.oauth_accounts if account.provider == identity["provider"] and account.subject == identity["subject"]), None)
    if existing:
        existing.email = identity.get("email")
        existing.email_verified = bool(identity.get("email_verified"))
        existing.full_name = identity.get("full_name")
        existing.avatar_url = identity.get("avatar_url")
        existing.provider_data = identity.get("provider_data", {})
        return
    user.oauth_accounts.append(
        UserOAuthIdentity(
            provider=identity["provider"],
            subject=identity["subject"],
            email=identity.get("email"),
            email_verified=bool(identity.get("email_verified")),
            full_name=identity.get("full_name"),
            avatar_url=identity.get("avatar_url"),
            provider_data=identity.get("provider_data", {}),
        )
    )


def _ensure_profile_for_role(db: Session, user: User) -> None:
    if user.role == Role.hotel_admin:
        profile = user.host_profile or (db.query(HostProfile).filter(HostProfile.user_id == user.id).first() if user.id else None)
        if profile is None:
            user.host_profile = HostProfile(user_id=user.id)
        elif user.host_profile is None:
            user.host_profile = profile
    elif user.role == Role.guest:
        profile = user.traveler_profile or (db.query(TravelerProfile).filter(TravelerProfile.user_id == user.id).first() if user.id else None)
        if profile is None:
            user.traveler_profile = TravelerProfile(user_id=user.id)
        elif user.traveler_profile is None:
            user.traveler_profile = profile


def _create_oauth_user(db: Session, identity: dict) -> User:
    full_name = identity.get("full_name") or (identity["email"].split("@")[0].replace(".", " ").replace("_", " ").strip().title())
    user = User(
        email=identity["email"].lower(),
        full_name=full_name,
        password_hash=hash_password(secrets.token_urlsafe(48)),
        role=Role.guest,
        is_active=True,
        email_verified=True,
        avatar_url=identity.get("avatar_url"),
        last_login_at=now_utc(),
    )
    db.add(user)
    db.flush()
    _ensure_profile_for_role(db, user)
    _upsert_oauth_identity(user, identity, db)
    return user


def _finish_oauth_login(db: Session, request: Request, response: Response | None, user: User) -> dict:
    user.failed_login_attempts = 0
    user.is_locked = False
    user.locked_until = None
    user.last_login_at = now_utc()
    _ensure_profile_for_role(db, user)
    if user.otp_enabled and user.otp_verified:
        temp_token, _jti, expires_at = create_temp_2fa_token(str(user.id))
        audit(db, action="auth.oauth_2fa_required", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        return {
            "requires_2fa": True,
            "requires2fa": True,
            "tempToken": temp_token,
            "temp_token": temp_token,
            "expiresAt": expires_at,
        }
    token_pair = _issue_token_pair(db, request, user)
    audit(db, action="auth.oauth_login", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    if response is not None:
        _set_auth_cookies(response, token_pair)
    return token_pair


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        enforce_password_policy(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=_role_from_frontend(payload.role),
        is_active=True,
    )
    db.add(user)
    db.flush()
    if user.role == Role.hotel_admin:
        db.add(HostProfile(user_id=user.id))
    elif user.role == Role.guest:
        db.add(TravelerProfile(user_id=user.id))
    audit(db, action="auth.register", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    token_pair = _issue_token_pair(db, request, user)
    db.commit()
    db.refresh(user)
    _set_auth_cookies(response, token_pair)
    return token_pair


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower(), User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.banned_at or user.suspended_at or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    if user.is_locked and user.locked_until and _aware(user.locked_until) > now_utc():
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account temporarily locked")
    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.is_locked = True
            user.locked_until = now_utc() + timedelta(minutes=15)
        audit(db, action="auth.login_failed", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    user.failed_login_attempts = 0
    user.is_locked = False
    user.locked_until = None
    user.last_login_at = now_utc()

    if user.otp_enabled and user.otp_verified:
        temp_token, _jti, expires_at = create_temp_2fa_token(str(user.id))
        audit(db, action="auth.2fa_required", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        return {"requires_2fa": True, "requires2fa": True, "tempToken": temp_token, "temp_token": temp_token, "expiresAt": expires_at}

    token_pair = _issue_token_pair(db, request, user)
    db.commit()
    _set_auth_cookies(response, token_pair)
    return token_pair


@router.get("/oauth/providers")
def oauth_providers():
    return _oauth_provider_availability()


@router.get("/oauth/{provider}/start")
def oauth_start(provider: OAuthProvider, request: Request, role: str = "Traveler"):
    frontend_origin = _frontend_origin_from_request(request)
    try:
        get_provider_config(provider)
    except ValueError as exc:
        return RedirectResponse(
            _login_redirect_url(error=_oauth_error_message(exc), frontend_origin=frontend_origin),
            status_code=status.HTTP_303_SEE_OTHER,
        )
    state = generate_oauth_state()
    nonce = generate_nonce()
    code_verifier = generate_pkce_verifier()
    cache.set_json(
        f"oauth:state:{state}",
        {
            "provider": provider.value,
            "role": Role.guest.value,
            "nonce": nonce,
            "code_verifier": code_verifier,
            "frontend_origin": frontend_origin,
        },
        settings.oauth_state_ttl_seconds,
    )
    authorize_url = build_authorize_url(provider=provider, state=state, nonce=nonce, code_verifier=code_verifier)
    return RedirectResponse(authorize_url, status_code=status.HTTP_303_SEE_OTHER)


async def _oauth_request_value(request: Request, key: str) -> str | None:
    if request.method.upper() == "POST":
        try:
            form = await request.form()
        except Exception:
            form = None
        if form and key in form:
            value = form.get(key)
            return str(value) if value is not None else None
    value = request.query_params.get(key)
    return value


@router.api_route("/oauth/{provider}/callback", methods=["GET", "POST"])
async def oauth_callback(provider: OAuthProvider, request: Request, response: Response, db: Session = Depends(get_db)):
    provider_name = provider.value
    fallback_frontend_origin = _frontend_origin_from_request(request)
    provider_error = await _oauth_request_value(request, "error")
    if provider_error:
        error_description = await _oauth_request_value(request, "error_description") or provider_error
        return RedirectResponse(_login_redirect_url(error=error_description, frontend_origin=fallback_frontend_origin), status_code=status.HTTP_303_SEE_OTHER)

    state = await _oauth_request_value(request, "state")
    code = await _oauth_request_value(request, "code")
    if not state or not code:
        return RedirectResponse(_login_redirect_url(error="oauth_missing_state_or_code", frontend_origin=fallback_frontend_origin), status_code=status.HTTP_303_SEE_OTHER)

    state_key = f"oauth:state:{state}"
    state_payload = cache.get_json(state_key)
    cache.delete(state_key)
    if not state_payload:
        return RedirectResponse(_login_redirect_url(error="oauth_state_expired", frontend_origin=fallback_frontend_origin), status_code=status.HTTP_303_SEE_OTHER)
    frontend_origin = str(state_payload.get("frontend_origin") or fallback_frontend_origin).rstrip("/")
    if state_payload.get("provider") != provider_name:
        return RedirectResponse(_login_redirect_url(error="oauth_provider_mismatch", frontend_origin=frontend_origin), status_code=status.HTTP_303_SEE_OTHER)

    try:
        token_payload = exchange_code_for_tokens(provider=provider, code=code, code_verifier=state_payload["code_verifier"])
        id_token = token_payload.get("id_token")
        if not id_token:
            raise RuntimeError("OAuth provider did not return an identity token")
        identity = verify_and_normalize_identity(
            provider=provider,
            id_token=id_token,
            nonce=state_payload["nonce"],
            access_token=token_payload.get("access_token"),
        )
    except Exception as exc:
        logger.exception("OAuth callback failed for provider=%s", provider_name)
        return RedirectResponse(_login_redirect_url(error=_oauth_error_message(exc), frontend_origin=frontend_origin), status_code=status.HTTP_303_SEE_OTHER)

    user = _find_user_by_oauth_identity(db, identity.provider, identity.subject)
    found_by_identity = user is not None
    linked_existing_email = False
    if not user:
        user = _find_user_by_email(db, identity.email or "")
        linked_existing_email = user is not None

    if user:
        if user.banned_at or user.suspended_at or not user.is_active:
            return RedirectResponse(_login_redirect_url(error="account_inactive", frontend_origin=frontend_origin), status_code=status.HTTP_303_SEE_OTHER)
        _upsert_oauth_identity(
            user,
            {
                "provider": identity.provider,
                "subject": identity.subject,
                "email": identity.email,
                "email_verified": identity.email_verified,
                "full_name": identity.full_name,
                "avatar_url": identity.avatar_url,
                "provider_data": identity.provider_data,
            },
            db,
        )
        user.email_verified = True
        if identity.avatar_url and not user.avatar_url:
            user.avatar_url = identity.avatar_url
        if identity.full_name and (not user.full_name or user.full_name == user.email.split("@")[0]):
            user.full_name = identity.full_name
    else:
        user = _create_oauth_user(
            db,
            {
                "provider": identity.provider,
                "subject": identity.subject,
                "email": identity.email,
                "email_verified": identity.email_verified,
                "full_name": identity.full_name,
                "avatar_url": identity.avatar_url,
                "provider_data": identity.provider_data,
            },
        )

    _ensure_profile_for_role(db, user)
    audit_action = "auth.oauth_login" if found_by_identity else "auth.oauth_account_linked" if linked_existing_email else "auth.oauth_account_created"
    audit(db, action=audit_action, actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))

    if user.otp_enabled and user.otp_verified:
        temp_token, _jti, _expires_at = create_temp_2fa_token(str(user.id))
        audit(db, action="auth.oauth_2fa_challenge", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        return RedirectResponse(_login_redirect_url(temp_token=temp_token, frontend_origin=frontend_origin), status_code=status.HTTP_303_SEE_OTHER)

    token_pair = _issue_token_pair(db, request, user)
    db.commit()
    session_code = _store_oauth_session(token_pair)
    final_response = RedirectResponse(_oauth_callback_redirect_url(user, session_code, frontend_origin), status_code=status.HTTP_303_SEE_OTHER)
    _set_auth_cookies(final_response, token_pair)
    return final_response


@router.post("/oauth/session")
def oauth_session(payload: OAuthSessionRequest, response: Response):
    session_key = f"oauth:session:{payload.code}"
    token_pair = cache.get_json(session_key)
    cache.delete(session_key)
    if not token_pair:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OAuth session expired. Please sign in again.")
    _set_auth_cookies(response, token_pair)
    return token_pair


@router.post("/refresh")
def refresh(payload: RefreshRequest | None = None, request: Request = None, response: Response = None, db: Session = Depends(get_db)):
    refresh_token = (payload.refresh_token if payload and payload.refresh_token else request.cookies.get("ubook_refresh_token"))    
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")
    try:
        token_payload = decode_token(refresh_token, expected_type="refresh", refresh=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if cache.is_blacklisted(token_payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_jti == token_payload["jti"])
        .first()
    )
    if session and session.revoked_at:
        user = db.get(User, session.user_id)
        db.query(UserSession).filter(UserSession.user_id == session.user_id, UserSession.revoked_at.is_(None)).update({"revoked_at": now_utc()})
        cache.blacklist_jti(token_payload["jti"], seconds_until(token_payload["exp"]))
        audit(db, action="auth.refresh_reuse_detected", actor=user, entity_type="session", entity_id=session.id, ip_address=client_ip(request))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")
    if not session or _aware(session.expires_at) < now_utc():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session expired")
    if token_payload.get("device") != _device_fingerprint(request):
        session.revoked_at = now_utc()
        cache.blacklist_jti(token_payload["jti"], seconds_until(token_payload["exp"]))
        audit(db, action="auth.refresh_device_mismatch", actor=session.user, entity_type="session", entity_id=session.id, ip_address=client_ip(request))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh device binding failed")
    user = db.get(User, int(token_payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    session.revoked_at = now_utc()
    cache.blacklist_jti(token_payload["jti"], seconds_until(token_payload["exp"]))
    token_pair = _issue_token_pair(db, request, user, mfa_verified="mfa" in token_payload.get("amr", []))
    audit(db, action="auth.refresh_rotated", actor=user, entity_type="session", entity_id=session.id, ip_address=client_ip(request))
    db.commit()
    _set_auth_cookies(response, token_pair)
    return token_pair


@router.post("/logout")
def logout(
    payload: LogoutRequest | None = None,
    request: Request = None,
    response: Response = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if credentials:
        token_payload = decode_token(credentials.credentials, expected_type="access")
        cache.blacklist_jti(token_payload["jti"], seconds_until(token_payload["exp"]))
    refresh_token = payload.refresh_token if payload else None
    if refresh_token:
        try:
            refresh_payload = decode_token(refresh_token, expected_type="refresh", refresh=True)
            cache.blacklist_jti(refresh_payload["jti"], seconds_until(refresh_payload["exp"]))
            session = db.query(UserSession).filter(UserSession.refresh_token_jti == refresh_payload["jti"]).first()
            if session:
                session.revoked_at = now_utc()
        except ValueError:
            pass
    audit(db, action="auth.logout", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_payload(user)


@router.get("/sessions")
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.deleted_at.is_(None))
        .order_by(UserSession.created_at.desc())
        .all()
    )
    return [_session_payload(session) for session in sessions]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: int, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(UserSession, session_id)
    if not session or session.deleted_at or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.revoked_at = now_utc()
    audit(db, action="auth.session_revoked", actor=user, entity_type="session", entity_id=session.id, ip_address=client_ip(request))
    db.commit()


def _session_payload(session: UserSession) -> dict:
    return {
        "id": session.id,
        "userAgent": session.user_agent,
        "ipAddress": session.ip_address,
        "expiresAt": session.expires_at.isoformat(),
        "revokedAt": session.revoked_at.isoformat() if session.revoked_at else None,
        "createdAt": session.created_at.isoformat(),
    }


@router.post("/ws-token")
def websocket_token(request: Request, user: User = Depends(get_current_user)):
    token, _jti, expires_at = create_access_token(str(user.id), {"role": user.role.value, "amr": ["ws"], "device": _device_fingerprint(request)})
    return {"token": token, "expiresAt": expires_at, "expires_at": expires_at}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is invalid")
    try:
        enforce_password_policy(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    user.password_hash = hash_password(payload.new_password)
    audit(db, action="auth.password_changed", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    return {"ok": True}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower(), User.deleted_at.is_(None)).first()
    response: dict = {"ok": True}
    if user:
        token, _jti, _exp = create_password_reset_token(str(user.id))
        password_reset(db, email=user.email, token=token)
        if not db.bind.url.render_as_string(hide_password=False).startswith("postgresql") or False:
            response["resetToken"] = token
        db.commit()
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    try:
        token_payload = decode_token(payload.token, expected_type="password_reset")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = db.get(User, int(token_payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        enforce_password_policy(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    user.password_hash = hash_password(payload.new_password)
    audit(db, action="auth.password_reset", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    return {"ok": True}


@router.post("/2fa/enable")
def enable_2fa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = new_otp_secret()
    user.otp_secret = secret
    user.otp_enabled = False
    user.otp_verified = False
    uri = otp_uri(secret, user.email)
    create_notification(db, notification_type="2fa_setup_started", subject="2FA setup started", body="A new authenticator setup was started.", user=user)
    db.commit()
    return {"secret": secret, "otpauthUrl": uri, "otpauth_url": uri, "qrCode": qr_code_data_url(uri), "qr_code": qr_code_data_url(uri)}


@router.post("/2fa/verify-setup")
def verify_setup(payload: TwoFactorVerifySetupRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.otp_secret or not verify_totp(user.otp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticator code")
    recovery_codes = generate_recovery_codes()
    user.otp_recovery_codes = [hash_recovery_code(code) for code in recovery_codes]
    user.otp_enabled = True
    user.otp_verified = True
    create_notification(db, notification_type="2fa_enabled", subject="2FA enabled", body="Two-factor authentication is now enabled.", user=user)
    audit(db, action="auth.2fa_enabled", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    return {"ok": True, "recoveryCodes": recovery_codes, "recovery_codes": recovery_codes}


def _consume_recovery_code(user: User, recovery_code: str | None) -> bool:
    if not recovery_code:
        return False
    hashed = hash_recovery_code(recovery_code)
    if hashed not in user.otp_recovery_codes:
        return False
    user.otp_recovery_codes = [code for code in user.otp_recovery_codes if code != hashed]
    return True


@router.post("/2fa/validate")
def validate_2fa(payload: TwoFactorValidateRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        token_payload = decode_token(payload.temp_token, expected_type="2fa_temp")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = db.get(User, int(token_payload["sub"]))
    if not user or not user.otp_secret or not user.otp_enabled:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="2FA is not enabled")
    attempts = cache.increment_window(f"2fa:attempts:{user.id}", 300)
    if attempts > 5:
        audit(db, action="auth.2fa_rate_limited", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many 2FA attempts")
    valid = bool(payload.code and verify_totp(user.otp_secret, payload.code)) or _consume_recovery_code(user, payload.recovery_code)
    if not valid:
        audit(db, action="auth.2fa_failed", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")
    cache.delete(f"2fa:attempts:{user.id}")
    token_pair = _issue_token_pair(db, request, user, mfa_verified=True)
    audit(db, action="auth.2fa_validated", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    _set_auth_cookies(response, token_pair)
    return token_pair


@router.post("/2fa/disable")
def disable_2fa(payload: TwoFactorDisableRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    valid = bool(payload.code and user.otp_secret and verify_totp(user.otp_secret, payload.code)) or _consume_recovery_code(user, payload.recovery_code)
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")
    user.otp_secret = None
    user.otp_enabled = False
    user.otp_verified = False
    user.otp_recovery_codes = []
    create_notification(db, notification_type="2fa_disabled", subject="2FA disabled", body="Two-factor authentication has been disabled.", user=user)
    audit(db, action="auth.2fa_disabled", actor=user, entity_type="user", entity_id=user.id, ip_address=client_ip(request))
    db.commit()
    return {"ok": True}
