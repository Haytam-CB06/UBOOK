from __future__ import annotations

import secrets
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.models import Booking, BookingStatus, BookingStatusHistory, Property, User
from app.schemas.booking import BookingCreate
from app.services import notification_service
from app.services.availability_service import BLOCKING_STATUSES, find_available_room
from app.services.pricing_service import calculate_price

ALLOWED_TRANSITIONS = {
    BookingStatus.draft: {BookingStatus.pending, BookingStatus.cancelled},
    BookingStatus.pending: {BookingStatus.confirmed, BookingStatus.rejected, BookingStatus.cancelled, BookingStatus.refunded},
    BookingStatus.confirmed: {BookingStatus.checked_in, BookingStatus.completed, BookingStatus.cancelled, BookingStatus.refunded},
    BookingStatus.rejected: set(),
    BookingStatus.checked_in: {BookingStatus.checked_out},
    BookingStatus.checked_out: {BookingStatus.completed, BookingStatus.refunded},
    BookingStatus.cancelled: set(),
    BookingStatus.completed: set(),
    BookingStatus.refunded: set(),
}


def booking_reference() -> str:
    return f"BK-{secrets.randbelow(900000) + 100000}"


def unique_booking_reference(db: Session) -> str:
    for _ in range(10):
        reference = booking_reference()
        if not db.query(Booking.id).filter(Booking.booking_reference == reference).first():
            return reference
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not allocate booking reference")


def create_booking(db: Session, *, payload: BookingCreate, user: User | None = None) -> Booking:
    property_ = db.get(Property, payload.property_id)
    if not property_ or property_.deleted_at or not property_.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if payload.check_in < date.today():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="check_in cannot be in the past")
    if user and property_.owner_id == user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hosts cannot book their own property")

    room, _remaining = find_available_room(
        db,
        property_id=payload.property_id,
        room_id=payload.room_id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        guests=payload.guests,
        lock=True,
    )
    if not room:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No availability for selected dates")

    pricing = calculate_price(db, property_=property_, check_in=payload.check_in, check_out=payload.check_out, guests=payload.guests)
    booking = Booking(
        booking_reference=unique_booking_reference(db),
        user_id=user.id if user else None,
        property_id=property_.id,
        room_id=room.id,
        full_name=payload.full_name,
        email=payload.email,
        traveler_count=payload.guests,
        check_in=payload.check_in,
        check_out=payload.check_out,
        status=BookingStatus.pending,
        special_requests=payload.notes,
        total_amount=pricing["total"],
        currency=pricing["currency"],
        pricing_breakdown=pricing,
    )
    db.add(booking)
    db.flush()
    db.add(BookingStatusHistory(booking_id=booking.id, from_status=None, to_status=BookingStatus.pending, changed_by_id=user.id if user else None))
    notification_service.booking_created(db, email=payload.email, booking_reference=booking.booking_reference)
    return booking


def transition_booking(db: Session, *, booking: Booking, to_status: BookingStatus, actor: User | None, reason: str | None = None) -> Booking:
    if to_status == booking.status:
        return booking
    if to_status not in ALLOWED_TRANSITIONS[booking.status]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Illegal transition from {booking.status.value} to {to_status.value}")
    if to_status == BookingStatus.confirmed:
        _assert_booking_can_be_confirmed(db, booking)
    from_status = booking.status
    booking.status = to_status
    booking.updated_at = datetime.now(timezone.utc)
    db.add(BookingStatusHistory(booking_id=booking.id, from_status=from_status, to_status=to_status, changed_by_id=actor.id if actor else None, reason=reason))
    if from_status in BLOCKING_STATUSES or to_status in BLOCKING_STATUSES:
        cache.delete_prefix("search:properties")
    return booking


def _assert_booking_can_be_confirmed(db: Session, booking: Booking) -> None:
    room, _remaining = find_available_room(
        db,
        property_id=booking.property_id,
        room_id=booking.room_id,
        check_in=booking.check_in,
        check_out=booking.check_out,
        guests=booking.traveler_count,
        lock=True,
    )
    if not room:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected dates are no longer available for this property")
