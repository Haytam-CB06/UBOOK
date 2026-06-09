# UBOOK V3 Audit Report

Audit date: 2026-06-07

Scope read: 162 repository files outside `.git` and vendor/build folders were opened and hashed. This included 127 text/source/config files and 35 binary/database/upload assets.

## Existing Architecture

### Frontend Architecture

- Vite + React + TypeScript application in `frontend/`.
- Routing is centralized in `frontend/src/routes/AppRoutes.tsx`.
- Most product UI is concentrated in `frontend/src/experience/pages.tsx`, a 2,821-line multi-page component file.
- API access is centralized in `frontend/src/services/api.ts` through Axios with cookie-based auth, CSRF header propagation, and refresh retry logic.
- React Query is used for server state. There is no dedicated domain state layer for booking/payment flows.
- Styling uses Tailwind with custom CSS tokens in `frontend/src/index.css`.

### Backend Architecture

- FastAPI application in `backend/app/main.py`.
- Routers live in `backend/app/api/`.
- SQLAlchemy models are concentrated in `backend/app/models/entities.py`.
- Services exist for booking, availability, pricing, payments, dashboards, notifications, storage, OAuth, and serialization.
- Auth uses JWT access/refresh tokens, refresh rotation, cookie support, CSRF for cookie-authenticated unsafe methods, and TOTP 2FA.
- Redis is optional through `CacheService`; it falls back to process memory.

### Database Architecture

- SQLAlchemy ORM with Alembic migrations.
- PostgreSQL is the production target; SQLite is used in tests.
- Main tables include users, sessions, OAuth identities, traveler/host profiles, properties, rooms, availability calendars, bookings, booking status history, payments, reviews, wishlists, favorites, messages, notifications, support, disputes, reports, risk events, and payouts.
- Existing migrations include a broad initial metadata create, forward-only expansion migrations, OAuth identities, operations tables, and a traveler schema migration.

## Critical Bugs

### Fixed In This Pass

- Booking creation used removed model fields `guests` and `notes`; current schema uses `traveler_count` and `special_requests`.
- Booking serialization and dashboard occupancy also referenced removed booking fields.
- Host calendar rows were displayed but not enforced during booking availability checks.
- Booking creation did not reject owner self-booking.
- Booking creation did not reject inactive listings.
- Property page selected dates and guests were not carried into checkout; checkout used hard-coded dates.
- Frontend called missing backend routes for payment overview, wallet, payment methods, receipts, invoices, reviews center, and travel finder.
- OAuth/frontend redirect origin handling treated comma-separated frontend URLs as one URL.
- GitHub Actions was under `.github/worflows`, so CI would not run.
- `backend/fix_alembic.py` contained local DB credentials and directly rewrote Alembic state.

### Remaining Production Gaps

- Payment confirmation is still a manual/client-triggered compatibility flow. Real production requires payment provider intents, webhook verification, idempotency keys, and signed provider events.
- Booking statuses do not yet fully match the requested lifecycle naming: `PENDING`, `AWAITING_PAYMENT`, `CONFIRMED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `REFUNDED`.
- No PostgreSQL exclusion constraint prevents overlapping single-unit bookings at the database level.
- Calendar availability is enforced by application logic, but production-grade concurrency should also use database constraints or advisory locks per property/room/date range.
- Guest-visible calendar endpoint is still limited; the current calendar management endpoint is host/admin only.
- Checkout remains a compact flow, not a full Airbnb-grade multi-step payment, cancellation policy, invoice, and notification experience.

## API Bugs

- Several frontend API functions pointed to missing backend routes; compatibility routes were added.
- Search availability filtering occurs in Python after paginated query results, which can underfill result pages.
- Host accept/reject endpoints are direct status transitions and do not model payment authorization versus capture.
- `profiles/me/verify-email` and `profiles/me/verify-phone` mark verification true without proof challenge.

## Auth Bugs

- Frontend URL defaults previously included multiple comma-separated URLs in a single setting.
- OAuth redirect default config had double slashes in local redirect URI defaults.
- Refresh token device binding uses IP + user-agent, which can break legitimate mobile/network changes.
- Cookie settings rely on environment values; local `.env` has insecure cookies by design for development.

## Booking Bugs

- Fixed schema drift from `guests`/`notes` to `traveler_count`/`special_requests`.
- Fixed selected dates not being submitted from property page checkout.
- Fixed backend not applying availability calendar closures/min-night rules.
- Remaining: no cancellation policy calculator, no invoice generation model, no provider-backed payment hold/capture, and no explicit draft reservation expiration.

## Payment Bugs

- Added missing payment overview/wallet/method/receipt/invoice compatibility routes.
- Added basic immutability/idempotency checks for succeeded/refunded payments.
- Remaining: no real card vault, no processor webhooks, no payout ledger, no wallet ledger table, no refunds tied to provider state.

## UI Bugs

- Checkout used fixed `2026-06-18` to `2026-06-22` dates regardless of user selection.
- Booking page summary used hard-coded 4 nights and 2 guests.
- Many dashboards are visually present but depend on simplified aggregate data.
- Dark mode tokens exist, but there is no complete user-facing dark-mode persistence flow.

## State Bugs

- Protected route role arrays are passed inline and can trigger repeated auth checks.
- Session expiry in frontend localStorage is fixed to 24 hours and does not use the backend access-token expiry precisely.
- Payment method functions had no backend support before this pass.

## Dead Code

- `backend/fix_alembic.py` was removed.
- Root `tests/` duplicates `backend/tests/` exactly.
- Root and backend Docker/start/backup scripts are duplicated.
- `.github/worflows/ci.yml` was moved to `.github/workflows/ci.yml`.
- Local SQLite DB files and upload artifacts are present in the working tree and should remain ignored.

## Security Issues

- Real secret-shaped values are present in local `.env` files. Rotate those credentials and keep only `.env.example` in source control.
- Email and phone verification endpoints do not verify ownership.
- Password reset stores reset tokens in notification bodies; production should deliver opaque links by email and store hashed reset token identifiers.
- Payment confirmation can still be initiated by authenticated clients for manual payments.
- `CacheService` memory fallback is not safe for multi-instance production token blacklist/rate-limit consistency.
- CSP is strict for API responses but frontend static deployment needs its own CSP headers.

## Performance Issues

- `frontend/src/experience/pages.tsx` is oversized and should be split by route and feature.
- `vendor-data-viz` build chunk is about 485 KB before gzip.
- Search loads joined relationships and then filters availability in Python.
- Dashboard services run multiple aggregate queries and relationship traversals that may become N+1 under production data.
- MongoDB pricing rules are fetched per pricing call without local caching.

## Verification

- Backend: `python -m pytest -q` passes, 10 tests.
- Frontend: `npm run build` passes.

