# UBOOK Database Review

## Current Schema

- SQLAlchemy models are centralized in `backend/app/models/entities.py`.
- Alembic migrations exist under `backend/alembic/versions`.
- Production target is PostgreSQL through `postgresql+psycopg`.
- Test target is SQLite with metadata create/drop.

## Strengths

- Core foreign keys exist across users, properties, rooms, bookings, payments, reviews, messages, and operational tables.
- Many high-cardinality fields have indexes.
- Booking has a date-range check constraint.
- Availability calendar has a uniqueness constraint on property, room, and date.
- Payments and payouts have non-negative amount checks.

## Issues

- The migration strategy uses `Base.metadata.create_all()` inside migrations. This is convenient but weak for controlled production DDL review.
- Several migrations are forward-only, which is acceptable for data safety but needs explicit rollback plans.
- Latest traveler migration dropped `bookings.guests` and `bookings.notes`; code was still using those fields until this pass.
- PostgreSQL enum migrations do not yet include the requested `awaiting_payment` and `active` lifecycle values.
- No PostgreSQL exclusion constraint prevents overlapping bookings for single-unit inventory.
- No payment ledger, wallet ledger, payment method, invoice, refund event, or payout event table exists.
- `EncryptedType` is deprecated and should be moved to `StringEncryptedType`.
- Local SQLite DB files exist in the repository working tree and should not be versioned.

## Fixed In This Pass

- Booking code now uses `traveler_count` and `special_requests`.
- Availability calendar rows now affect backend availability checks.
- Owner self-booking and inactive property booking are blocked.

## Recommended Migrations

- Add explicit booking lifecycle enum values and backfill legacy statuses.
- Add a payment ledger table with immutable entries.
- Add invoice table with line items and generated document metadata.
- Add refund event table with provider references.
- Add payment method table only if storing tokenized provider references.
- Add partial/exclusion constraints for no-overlap rules where inventory is one.
- Add indexes for:
  - `bookings(user_id, check_in)`
  - `bookings(property_id, status, check_in, check_out)`
  - `payments(user_id, status, created_at)`
  - `messages(conversation_id, created_at)`

