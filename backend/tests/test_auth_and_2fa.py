from __future__ import annotations

import pyotp

from app.core.database import SessionLocal
from app.models import Role, User
from app.api.auth import _create_oauth_user, _oauth_callback_redirect_url
from app.core.cache import cache

from conftest import auth_headers


def test_register_login_refresh_me_logout(client):
    register = client.post(
        "/api/auth/register",
        json={"email": "new@ubook.ma", "password": "StrongPass123!", "fullName": "New Guest", "role": "Guest"},
    )
    assert register.status_code == 201, register.text
    tokens = register.json()
    assert tokens["accessToken"]
    assert tokens["user"]["name"] == "New Guest"
    assert tokens["user"]["otpEnabled"] is False
    assert tokens["user"]["securitySetupRequired"] is True

    login = client.post("/api/auth/login", json={"email": "new@ubook.ma", "password": "StrongPass123!"})
    assert login.status_code == 200
    refresh = client.post("/api/auth/refresh", json={"refreshToken": login.json()["refreshToken"]})
    assert refresh.status_code == 200

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh.json()['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@ubook.ma"
    assert me.json()["securitySetupRequired"] is True

    logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {refresh.json()['accessToken']}"})
    assert logout.status_code == 200


def test_refresh_survives_render_proxy_ip_changes(client):
    user_agent = "Mozilla/5.0 UBOOK Render smoke test"
    login = client.post(
        "/api/auth/login",
        json={"email": "guest@ubook.ma", "password": "GuestPass123!"},
        headers={"user-agent": user_agent, "x-forwarded-for": "10.193.111.3"},
    )
    assert login.status_code == 200, login.text

    refresh = client.post(
        "/api/auth/refresh",
        json={"refreshToken": login.json()["refreshToken"]},
        headers={"user-agent": user_agent, "x-forwarded-for": "10.195.112.64"},
    )
    assert refresh.status_code == 200, refresh.text
    assert refresh.json()["accessToken"]


def test_social_signup_creates_traveler_account():
    db = SessionLocal()
    try:
        user = _create_oauth_user(
            db,
            {
                "provider": "google",
                "subject": "oauth-traveler-1",
                "email": "oauth-traveler@ubook.ma",
                "email_verified": True,
                "full_name": "OAuth Traveler",
                "avatar_url": None,
                "provider_data": {},
            },
        )
        assert user.role == Role.guest
        assert user.traveler_profile is not None
        assert user.host_profile is None
    finally:
        db.rollback()
        db.close()


def test_oauth_session_exchange_is_one_time(client):
    login = client.post("/api/auth/login", json={"email": "guest@ubook.ma", "password": "GuestPass123!"})
    assert login.status_code == 200, login.text
    cache.set_json("oauth:session:test-oauth-session", login.json(), 60)

    exchange = client.post("/api/auth/oauth/session", json={"code": "test-oauth-session"})
    assert exchange.status_code == 200, exchange.text
    assert exchange.json()["accessToken"]
    assert exchange.json()["user"]["role"] == "Traveler"

    replay = client.post("/api/auth/oauth/session", json={"code": "test-oauth-session"})
    assert replay.status_code == 401


def test_oauth_callback_redirects_to_safe_frontend_handoff():
    user = User(id=123, email="oauth@ubook.ma", full_name="OAuth Traveler", role=Role.guest)
    redirect = _oauth_callback_redirect_url(user, "safe-code", "https://ubook-f.onrender.com")
    assert redirect.startswith("https://ubook-f.onrender.com/oauth/callback?")
    assert "code=safe-code" in redirect
    assert "redirectTo=%2Fdashboard" in redirect


def test_2fa_setup_login_validate_and_disable(client):
    headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    setup = client.post("/api/auth/2fa/enable", headers=headers)
    assert setup.status_code == 200, setup.text
    assert setup.json()["qrCode"].startswith("data:image/png;base64,")

    code = pyotp.TOTP(setup.json()["secret"]).now()
    verify = client.post("/api/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    assert verify.status_code == 200, verify.text
    assert len(verify.json()["recoveryCodes"]) == 10
    enabled_profile = client.get("/api/auth/me", headers=headers)
    assert enabled_profile.status_code == 200
    assert enabled_profile.json()["otpEnabled"] is True
    assert enabled_profile.json()["securitySetupRequired"] is False

    login = client.post("/api/auth/login", json={"email": "guest@ubook.ma", "password": "GuestPass123!"})
    assert login.status_code == 200
    assert login.json()["requires_2fa"] is True

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "guest@ubook.ma").one()
        code = pyotp.TOTP(user.otp_secret).now()
    finally:
        db.close()
    validated = client.post("/api/auth/2fa/validate", json={"tempToken": login.json()["tempToken"], "code": code})
    assert validated.status_code == 200, validated.text
    assert validated.json()["accessToken"]

    disable_headers = {"Authorization": f"Bearer {validated.json()['accessToken']}"}
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "guest@ubook.ma").one()
        code = pyotp.TOTP(user.otp_secret).now()
    finally:
        db.close()
    disabled = client.post("/api/auth/2fa/disable", json={"password": "GuestPass123!", "code": code}, headers=disable_headers)
    assert disabled.status_code == 200, disabled.text
    disabled_profile = client.get("/api/auth/me", headers=disable_headers)
    assert disabled_profile.status_code == 200
    assert disabled_profile.json()["otpEnabled"] is False
    assert disabled_profile.json()["securitySetupRequired"] is True


def test_2fa_rate_limit(client):
    headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    setup = client.post("/api/auth/2fa/enable", headers=headers)
    code = pyotp.TOTP(setup.json()["secret"]).now()
    assert client.post("/api/auth/2fa/verify-setup", json={"code": code}, headers=headers).status_code == 200
    login = client.post("/api/auth/login", json={"email": "guest@ubook.ma", "password": "GuestPass123!"})
    for _ in range(5):
        assert client.post("/api/auth/2fa/validate", json={"tempToken": login.json()["tempToken"], "code": "000000"}).status_code == 401
    assert client.post("/api/auth/2fa/validate", json={"tempToken": login.json()["tempToken"], "code": "000000"}).status_code == 429


def test_rate_limited_login_keeps_cors_headers(client):
    headers = {"Origin": "http://localhost:5173"}
    payload = {"email": "guest@ubook.ma", "password": "wrong-password"}
    response = None
    for _ in range(6):
        response = client.post("/api/auth/login", json=payload, headers=headers)

    assert response is not None
    assert response.status_code == 429
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
