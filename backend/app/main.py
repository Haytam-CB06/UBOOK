from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
import secrets

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import admin, auth, bookings, favorites, health, host, messaging, notifications, operations, payments, profiles, properties, reviews, saved_searches, traveler, uploads, wishlists
from app.core.cache import cache
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.rate_limit import check_rate_limit
from app.seed import seed_database


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if settings.auto_create_tables:
            Base.metadata.create_all(bind=engine)
        if settings.auto_seed:
            db = SessionLocal()
            try:
                seed_database(db)
            finally:
                db.close()
        yield

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        openapi_url=f"{settings.api_prefix}/openapi.json",
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=f"{settings.api_prefix}/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def hardening_and_rate_limit(request: Request, call_next):
        correlation_id = request.headers.get("x-correlation-id") or secrets.token_urlsafe(16)
        request.state.correlation_id = correlation_id
        if request.url.path not in {"/health", f"{settings.api_prefix}/health"}:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > max(settings.max_upload_bytes, 1024 * 1024):
                return JSONResponse(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, content={"detail": "Request body too large"})
            allowed, limit, window = check_rate_limit(request)
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded", "limit": limit, "windowSeconds": window, "correlationId": correlation_id},
                )
            csrf_error = _csrf_error(request)
            if csrf_error:
                return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": csrf_error, "correlationId": correlation_id})
        response: Response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    app.include_router(health.router)
    app.include_router(health.router, prefix=settings.api_prefix)
    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(properties.router, prefix=settings.api_prefix)
    app.include_router(bookings.router, prefix=settings.api_prefix)
    app.include_router(reviews.router, prefix=settings.api_prefix)
    app.include_router(favorites.router, prefix=settings.api_prefix)
    app.include_router(wishlists.router, prefix=settings.api_prefix)
    app.include_router(payments.router, prefix=settings.api_prefix)
    app.include_router(profiles.router, prefix=settings.api_prefix)
    app.include_router(host.router, prefix=settings.api_prefix)
    app.include_router(traveler.router, prefix=settings.api_prefix)
    app.include_router(notifications.router, prefix=settings.api_prefix)
    app.include_router(messaging.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    app.include_router(saved_searches.router, prefix=settings.api_prefix)
    app.include_router(operations.router, prefix=settings.api_prefix)
    app.include_router(uploads.router, prefix=settings.api_prefix)
    if settings.storage_provider == "local":
        Path(settings.local_upload_dir).mkdir(parents=True, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=settings.local_upload_dir), name="uploads")

    return app


app = create_app()


def _csrf_error(request: Request) -> str | None:
    if request.method.upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None
    if not request.url.path.startswith(settings.api_prefix):
        return None
    if request.headers.get("authorization"):
        return None
    if request.url.path in {
        f"{settings.api_prefix}/auth/login",
        f"{settings.api_prefix}/auth/register",
        f"{settings.api_prefix}/auth/refresh",
        f"{settings.api_prefix}/auth/forgot-password",
        f"{settings.api_prefix}/auth/reset-password",
        f"{settings.api_prefix}/auth/2fa/validate",
    }:
        return None
    if not request.cookies.get("ubook_access_token"):
        return None
    cookie_token = request.cookies.get("ubook_csrf_token")
    header_token = request.headers.get("x-csrf-token")
    if not cookie_token or not header_token or not secrets.compare_digest(cookie_token, header_token):
        return "CSRF token validation failed"
    return None
