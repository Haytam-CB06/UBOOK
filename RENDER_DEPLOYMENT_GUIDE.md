# Render Deployment Guide

## Services

`render.yaml` defines:

- `ubook-back`: Docker web service rooted at `backend`.
- `ubook-front`: static site rooted at `frontend`.
- `ubook-redis`: Render keyvalue service.
- `ubook-db`: Render PostgreSQL database.

## Backend Startup

The backend Dockerfile runs:

```bash
/app/scripts/start.sh
```

That script:

1. Creates the upload directory.
2. Runs `alembic upgrade head`.
3. Optionally seeds when `UBOOK_AUTO_SEED=true`.
4. Starts Uvicorn on `$PORT` or 8080.

## Required Render Environment

Backend:

- `UBOOK_ENVIRONMENT=production`
- `UBOOK_DATABASE_URL` from `ubook-db`
- `UBOOK_REDIS_URL` from `ubook-redis`
- `UBOOK_SECRET_KEY` generated
- `UBOOK_REFRESH_SECRET_KEY` generated
- `UBOOK_FIELD_ENCRYPTION_KEY` generated
- `UBOOK_FRONTEND_URL=https://ubook-front.onrender.com`
- `UBOOK_CORS_ORIGINS=https://ubook-front.onrender.com`
- `UBOOK_SECURE_COOKIES=true`
- `UBOOK_AUTH_COOKIE_SAMESITE=none`
- `UBOOK_AUTO_CREATE_TABLES=false`
- `UBOOK_AUTO_SEED=false`
- `UBOOK_STORAGE_PROVIDER=cloudinary`
- `UBOOK_CLOUDINARY_URL` set from your Cloudinary account
- `UBOOK_REFRESH_TOKEN_DAYS=7`

Frontend:

- `VITE_API_BASE_URL=https://ubook-back.onrender.com/api`
- `VITE_REQUIRE_AUTH=true`
- `VITE_AUTH_SESSION_STORAGE=local`

## Known Render Risks

- Render free web services spin down after idle periods, so the first request after inactivity can be slow.
- Render free disks are ephemeral. Keep `UBOOK_STORAGE_PROVIDER=cloudinary` or use another durable object store for listing photos.
- Free PostgreSQL/Redis plans are acceptable for smoke testing, not commercial production.
- If Redis is unavailable, the app falls back to in-memory cache. Production should fail closed instead.
- Real OAuth redirect URIs must match the Render backend hostname.
- Secrets exposed in local `.env` files must be rotated before deployment.

## Verification Checklist

- Backend deploy succeeds.
- Alembic reaches head.
- `/api/health` returns ok.
- Frontend static site loads and rewrites routes to `index.html`.
- Register/login works.
- Refresh flow works.
- 2FA setup and login challenge work.
- Search returns properties.
- Property page pricing and availability calls work.
- Booking creation succeeds for available dates.
- Double booking is rejected when inventory is exhausted.
- Manual payment compatibility flow confirms a booking.
- Traveler, host, and admin dashboards load.
