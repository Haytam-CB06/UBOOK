# UBOOK Architecture

## Current State

UBOOK is a FastAPI + React marketplace. The backend already has separation between API routers, services, schemas, models, and core infrastructure, but the domain model is concentrated in one large ORM file and several workflows still mix application rules with route handlers.

The frontend has a production-oriented visual shell, but most screens live in a single `pages.tsx` file. The booking flow now passes selected dates/guests into checkout and uses live availability/pricing, but the flow is not yet a full domain workflow with explicit draft/payment/confirmation states.

## Target Clean Architecture

### Domain

- Entities: User, HostProfile, TravelerProfile, Property, Room, AvailabilityDay, Booking, BookingStatusHistory, Payment, Refund, Payout, Review, Conversation, Notification.
- Value objects: DateRange, Money, GuestCount, CancellationPolicy, BookingReference, PaymentReference.
- Domain services: AvailabilityPolicy, BookingPolicy, CancellationCalculator, PaymentStateMachine.

### Application

- Use cases:
  - SearchProperties
  - QuoteReservation
  - CreateReservationDraft
  - ConfirmAvailability
  - StartPayment
  - ConfirmPaymentFromWebhook
  - ConfirmBooking
  - CancelBooking
  - RefundBooking
  - HostManageCalendar
  - TravelerDashboard
  - HostDashboard
  - AdminModeration
- Use cases should own transactions and call repositories/services.

### Infrastructure

- SQLAlchemy repositories.
- Redis cache/session blacklist/rate limiting.
- Payment provider adapter for Stripe or equivalent.
- Email/SMS provider adapter for verification, booking notifications, and password reset.
- Object storage adapter for local, Cloudinary, or S3.

### Presentation

- FastAPI routers should validate input, call use cases, and serialize output.
- React routes should be split by product area:
  - `routes/public`
  - `routes/search`
  - `routes/property`
  - `routes/booking`
  - `routes/traveler`
  - `routes/host`
  - `routes/admin`
- Shared UI primitives should stay in `components/ui`.
- Feature components should own local view state only; server state should stay in React Query hooks.

## Booking Flow Architecture

Target flow:

1. Quote dates/guests.
2. Validate availability inside a database transaction.
3. Create reservation draft or pending booking.
4. Start payment intent.
5. Confirm payment through provider webhook.
6. Transition booking to confirmed.
7. Send notifications.
8. Generate invoice.
9. Update availability projections.

Current implementation now fixes the broken path and enforces calendar rules in availability checks, but provider-backed payment and invoice generation remain future work.

## Status Model

Target statuses:

- `PENDING`
- `AWAITING_PAYMENT`
- `CONFIRMED`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

Current statuses are still lower-case ORM enum values and include legacy states such as `checked_in`, `checked_out`, and `rejected`. A production migration should add the target values, backfill legacy values, and update frontend labels.

## Key Refactor Plan

- Split `backend/app/models/entities.py` by bounded context.
- Introduce booking/payment use-case classes with explicit transaction boundaries.
- Add repository methods for availability overlap checks.
- Split `frontend/src/experience/pages.tsx` by route.
- Add typed feature hooks such as `useReservationQuote`, `useBookingCheckout`, and `useHostCalendar`.
- Replace manual payment compatibility with a provider adapter and webhook route.

