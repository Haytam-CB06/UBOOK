# UBOOK Testing Report

## Commands Run

Backend:

```bash
cd backend
python -m pytest -q
```

Result:

```text
10 passed, 46 warnings
```

Frontend:

```bash
cd frontend
npm run build
```

Result:

```text
TypeScript check passed
Vite production build passed
```

Local live smoke:

```text
GET /api/health -> ok
POST /api/auth/login -> 200
POST /api/bookings -> 201 Pending
POST /api/payments -> 201 pending
POST /api/payments/{id}/confirm -> 200 succeeded
```

## Initial Failures Found

- Backend tests initially failed at import because `sqlalchemy_utils` was missing from the local Python environment.
- After installing requirements, 3 backend tests failed because booking creation still used removed `Booking` fields `guests` and `notes`.

## Fixed Failures

- Replaced booking creation with `traveler_count` and `special_requests`.
- Replaced serializer/dashboard references to `booking.guests` and `booking.notes`.
- Backend suite now passes.

## Current Coverage Gaps

- No frontend component or Playwright E2E tests.
- No real payment provider tests.
- No webhook signature tests.
- No concurrent double-booking stress test.
- No cancellation policy tests.
- No invoice generation tests.
- No Render smoke test automation.
- No coverage report was generated in this pass, so 90% coverage is not demonstrated.

## Recommended Next Tests

- Reservation conflict tests with parallel requests against PostgreSQL.
- Calendar closure and min-night booking tests.
- Owner self-booking test.
- Inactive property booking test.
- Payment idempotency and refund transition tests.
- Email/phone verification tests after challenge flow implementation.
- Playwright test for search -> property -> booking -> payment -> dashboard.
