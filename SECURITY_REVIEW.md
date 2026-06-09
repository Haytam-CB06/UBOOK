# UBOOK Security Review

## High Risk

- Secret-shaped values exist in local `.env` files. Rotate Cloudinary, Google OAuth, Microsoft OAuth, AWS-style, database, and any reused secrets. Keep `.env` ignored and never commit real values.
- Email and phone verification endpoints set verified flags without sending or validating a challenge.
- Manual payment confirmation remains callable by authenticated clients. Production should confirm external payments only from verified provider webhooks or privileged back-office flows.
- The in-memory cache fallback is not production-safe for token blacklist, OAuth state, 2FA attempt limits, or rate limiting across multiple instances.

## Medium Risk

- Password reset tokens are written into notification bodies. Store only hashed token identifiers and deliver reset links through an email provider.
- Refresh token device binding uses IP address and user-agent. It improves theft detection but can lock out legitimate users on network change.
- OAuth defaults include local redirect URI values; production variables in Render must be authoritative.
- Upload validation checks content type, extension, dimensions, and re-encodes images, but malware scanning is not present.
- Admin destructive actions require MFA in many places, but not every sensitive operational action is audited with full metadata.

## Low Risk

- API security headers are set in middleware.
- Cookie auth has CSRF protection for unsafe API methods.
- JWTs include issuer, audience, type, expiry, and jti.
- 2FA recovery codes are hashed before storage.

## Fixed In This Pass

- Removed `backend/fix_alembic.py`, which contained local database credentials and direct Alembic table mutation.
- Fixed frontend origin parsing for OAuth/login redirects.
- Added payment state immutability checks for succeeded/refunded payments.
- Added owner self-booking prevention.

## Required Before Production

- Rotate all exposed local secrets.
- Add verified email and phone challenge flows.
- Implement provider-backed payment intents and webhook verification.
- Require Redis in production and fail startup if unavailable for distributed auth/rate-limit features.
- Add audit metadata for payment, refund, admin moderation, and identity verification events.
- Add security tests for authorization boundaries, CSRF, refresh reuse, 2FA recovery code consumption, and upload rejection.

