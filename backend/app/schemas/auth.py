from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import Role
from app.schemas.base import CamelInputModel


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    email: EmailStr
    full_name: str = Field(serialization_alias="fullName")
    name: str | None = None
    role: Role
    otp_enabled: bool = Field(serialization_alias="otpEnabled")
    linked_providers: list[str] = Field(default_factory=list, serialization_alias="linkedProviders")


class RegisterRequest(CamelInputModel):
    field_aliases = {"fullName": "full_name"}
    email: EmailStr
    password: str
    full_name: str
    role: str = "Guest"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(CamelInputModel):
    field_aliases = {"refreshToken": "refresh_token"}
    refresh_token: str | None = None


class LogoutRequest(CamelInputModel):
    field_aliases = {"refreshToken": "refresh_token"}
    refresh_token: str | None = None


class OAuthSessionRequest(CamelInputModel):
    field_aliases = {"sessionCode": "code", "session": "code"}
    code: str


class AuthResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    refresh_token: str = Field(serialization_alias="refreshToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")
    expires_at: datetime = Field(serialization_alias="expiresAt")
    token: str
    user: UserOut


class LoginTwoFactorRequired(BaseModel):
    requires_2fa: bool = Field(serialization_alias="requires2fa")
    temp_token: str = Field(serialization_alias="tempToken")
    expires_at: datetime = Field(serialization_alias="expiresAt")


class ChangePasswordRequest(CamelInputModel):
    field_aliases = {"currentPassword": "current_password", "newPassword": "new_password"}
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(CamelInputModel):
    field_aliases = {"newPassword": "new_password"}
    token: str
    new_password: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_url: str = Field(serialization_alias="otpauthUrl")
    qr_code: str = Field(serialization_alias="qrCode")


class TwoFactorVerifySetupRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TwoFactorValidateRequest(CamelInputModel):
    field_aliases = {"tempToken": "temp_token", "recoveryCode": "recovery_code"}
    temp_token: str
    code: str | None = Field(default=None, min_length=6, max_length=8)
    recovery_code: str | None = None


class TwoFactorDisableRequest(CamelInputModel):
    field_aliases = {"recoveryCode": "recovery_code"}
    password: str
    code: str | None = Field(default=None, min_length=6, max_length=8)
    recovery_code: str | None = None
