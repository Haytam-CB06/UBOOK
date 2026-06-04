from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Property, Room

BLOCKING_STATUSES = [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_in]


def overlapping_bookings_query(db: Session, room_id: int, check_in: date, check_out: date):
    return (
        db.query(Booking)
        .filter(Booking.room_id == room_id)
        .filter(Booking.deleted_at.is_(None))
        .filter(Booking.status.in_(BLOCKING_STATUSES))
        .filter(Booking.check_in < check_out)
        .filter(Booking.check_out > check_in)
    )


def find_available_room(
    db: Session,
    *,
    property_id: int,
    check_in: date,
    check_out: date,
    guests: int,
    room_id: int | None = None,
    lock: bool = False,
) -> tuple[Room | None, int]:
    if check_in >= check_out:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="check_in must be before check_out")

    query = db.query(Room).filter(Room.property_id == property_id, Room.active.is_(True), Room.deleted_at.is_(None), Room.capacity >= guests)
    if room_id:
        query = query.filter(Room.id == room_id)
    if lock:
        query = query.with_for_update()
    rooms = query.order_by(Room.base_price.asc()).all()

    for room in rooms:
        used = overlapping_bookings_query(db, room.id, check_in, check_out).count()
        remaining = max(0, room.inventory_count - used)
        if remaining > 0:
            return room, remaining
    return None, 0


def availability_payload(db: Session, *, property_id: int, check_in: date, check_out: date, guests: int) -> dict:
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    room, remaining = find_available_room(db, property_id=property_id, check_in=check_in, check_out=check_out, guests=guests)
    return {
        "propertyId": property_id,
        "checkIn": check_in,
        "checkOut": check_out,
        "available": room is not None,
        "remainingUnits": remaining,
        "roomId": room.id if room else None,
    }

