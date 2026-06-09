# UBOOK Deployment Guide

## Prerequisites

- Python 3.12
- Node 20 or newer
- PostgreSQL for production
- Redis for production
- Optional: Cloudinary or S3 for durable uploads

## Backend

Install dependencies:

```bash
cd backend
python -m pip install -r requirements.txt
```

Run tests:

```bash
python -m pytest -q
```

Run locally:

```bash
set UBOOK_ENVIRONMENT=development
set UBOOK_DATABASE_URL=sqlite:///./dev.db
set UBOOK_AUTO_CREATE_TABLES=true
set UBOOK_AUTO_SEED=true
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Production startup uses `backend/scripts/start.sh`, which creates the upload directory, runs `alembic upgrade head`, optionally seeds, and starts Uvicorn.

## Frontend

Install dependencies:

```bash
cd frontend
npm ci
```

Build:

```bash
npm run build
```

Required production env:

```bash
VITE_API_BASE_URL=https://<backend-host>/api
VITE_REQUIRE_AUTH=true
VITE_AUTH_SESSION_STORAGE=local
```

## Required Environment Variables

- `UBOOK_ENVIRONMENT=production`
- `UBOOK_DATABASE_URL`
- `UBOOK_REDIS_URL`
- `UBOOK_SECRET_KEY`
- `UBOOK_REFRESH_SECRET_KEY`
- `UBOOK_FIELD_ENCRYPTION_KEY`
- `UBOOK_FRONTEND_URL`
- `UBOOK_CORS_ORIGINS`
- `UBOOK_SECURE_COOKIES=true`
- `UBOOK_AUTH_COOKIE_SAMESITE=none` for cross-site Render frontend/backend
- `UBOOK_STORAGE_PROVIDER=cloudinary` on Render/free hosting
- `UBOOK_CLOUDINARY_URL` or Cloudinary cloud/key/secret values for durable uploads
- `UBOOK_REFRESH_TOKEN_DAYS=7` or your desired refresh cookie lifetime

## Preflight

- Rotate all local exposed secrets before deployment.
- Confirm `.env` files are ignored and not committed.
- Run backend tests and frontend build.
- Run `alembic upgrade head` against a staging database.
- Verify `/api/health`.
- Verify register, login, 2FA, search, property detail, booking creation, payment compatibility flow, dashboards, and messaging.
