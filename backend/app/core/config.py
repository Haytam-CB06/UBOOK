from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="UBOOK_", extra="ignore")

    app_name: str = "UBOOK API"
    environment: Literal["development", "test", "staging", "production"] = "development"
    api_prefix: str = "/api"
    secret_key: str = Field(default="change-me-in-production-with-64-random-characters")
    refresh_secret_key: str = Field(default="change-me-refresh-in-production-with-64-random-characters")
    jwt_audience: str = "ubook-web"
    access_token_minutes: int = 15
    refresh_token_days: int = 1
    temp_token_minutes: int = 5

    database_url: str = "postgresql+psycopg://ubook:ubook@localhost:5432/ubook"
    redis_url: str = "redis://localhost:6379/0"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "ubook_pricing"

    cors_origins: str = "http://localhost:5173/,http://localhost:3000,http://127.0.0.1:5173,https://ubook-s9ns.onrender.com,https://ubook-s9ns.onrender.com/"
    frontend_url: str = "http://localhost:5173/,https://ubook-s9ns.onrender.com/,https://ubook-s9ns.onrender.com"
    auto_create_tables: bool = False
    auto_seed: bool = False
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    local_upload_dir: str = "uploads"
    storage_provider: Literal["local", "cloudinary", "s3"] = "local"
    cloudinary_url: str | None = None
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "us-east-1"
    s3_bucket: str | None = None
    public_assets_base_url: str | None = None
    secure_cookies: bool = False
    auth_cookie_domain: str | None = None
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "none"
    max_upload_bytes: int = 5 * 1024 * 1024
    field_encryption_key: str | None = None
    password_reset_minutes: int = 30
    issuer: str = "ubook"
    oauth_state_ttl_seconds: int = 600
    oauth_javascript_origins: str = "http://localhost:5173/,http://127.0.0.1:5173"
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8080//api/auth/oauth/google/callback"
    microsoft_client_id: str | None = None
    microsoft_client_secret: str | None = None
    microsoft_tenant_id: str = "common"
    microsoft_redirect_uri: str = "http://localhost:8080//api/auth/oauth/microsoft/callback"
    apple_client_id: str | None = None
    apple_team_id: str | None = None
    apple_key_id: str | None = None
    apple_private_key: str | None = None
    apple_redirect_uri: str = "http://localhost:8080//api/auth/oauth/apple/callback"

    @field_validator("secret_key", "refresh_secret_key")
    @classmethod
    def require_real_secrets_in_production(cls, value: str, info):
        if info.data.get("environment") == "production" and value.startswith("change-me"):
            raise ValueError(f"UBOOK_{info.field_name.upper()} must be set in production")
        return value

    @field_validator("cors_origins")
    @classmethod
    def forbid_wildcard_cors_in_production(cls, value: str, info):
        if info.data.get("environment") == "production" and "*" in {origin.strip() for origin in value.split(",")}:
            raise ValueError("UBOOK_CORS_ORIGINS cannot contain '*' in production")
        return value

    @field_validator("database_url")
    @classmethod
    def normalize_postgres_driver(cls, value: str) -> str:
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql://", 1)
        if value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def oauth_javascript_origin_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.oauth_javascript_origins.split(",") if origin.strip()]

    @property
    def is_test(self) -> bool:
        return self.environment == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
