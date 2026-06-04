from __future__ import annotations

import pyotp

from app.core.database import SessionLocal
from app.models import User

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

    login = client.post("/api/auth/login", json={"email": "new@ubook.ma", "password": "StrongPass123!"})
    assert login.status_code == 200
    refresh = client.post("/api/auth/refresh", json={"refreshToken": login.json()["refreshToken"]})
    assert refresh.status_code == 200

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh.json()['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@ubook.ma"

    logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {refresh.json()['accessToken']}"})
    assert logout.status_code == 200


def test_2fa_setup_login_validate_and_disable(client):
    headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    setup = client.post("/api/auth/2fa/enable", headers=headers)
    assert setup.status_code == 200, setup.text
    assert setup.json()["qrCode"].startswith("data:image/png;base64,")

    code = pyotp.TOTP(setup.json()["secret"]).now()
    verify = client.post("/api/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    assert verify.status_code == 200, verify.text
    assert len(verify.json()["recoveryCodes"]) == 10

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


def test_2fa_rate_limit(client):
    headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    setup = client.post("/api/auth/2fa/enable", headers=headers)
    code = pyotp.TOTP(setup.json()["secret"]).now()
    assert client.post("/api/auth/2fa/verify-setup", json={"code": code}, headers=headers).status_code == 200
    login = client.post("/api/auth/login", json={"email": "guest@ubook.ma", "password": "GuestPass123!"})
    for _ in range(5):
        assert client.post("/api/auth/2fa/validate", json={"tempToken": login.json()["tempToken"], "code": "000000"}).status_code == 401
    assert client.post("/api/auth/2fa/validate", json={"tempToken": login.json()["tempToken"], "code": "000000"}).status_code == 429
