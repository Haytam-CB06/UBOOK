from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import AvailabilityCalendar, Booking, BookingStatus, Property, Room, RoomType

BOOKING_REQUEST_STATUSES = [BookingStatus.pending]
BLOCKING_STATUSES = [BookingStatus.confirmed, BookingStatus.checked_in]
HOST_CALENDAR_STATUSES = [*BOOKING_REQUEST_STATUSES, *BLOCKING_STATUSES]


def ensure_bookable_rooms(db: Session, property_: Property, *, lock: bool = False) -> list[Room]:
    query = db.query(Room).filter(Room.property_id == property_.id, Room.deleted_at.is_(None))
    if lock:
        query = query.with_for_update()
    rooms = query.all()
    active_rooms = [room for room in rooms if room.active]
    if rooms:
        return active_rooms

    capacity = int(property_.max_guests or property_.capacity or 1)
    nightly_price = float(property_.price_per_night if property_.price_per_night is not None else property_.base_price or 1)
    room_type = RoomType(
        property_id=property_.id,
        code="default-bookable-unit",
        name="Entire place",
        description="Default bookable unit for this listing.",
        base_price_modifier=0,
        sleeps=max(1, capacity),
    )
    db.add(room_type)
    db.flush()
    room = Room(
        property_id=property_.id,
        room_type_id=room_type.id,
        room_number="default-bookable-unit",
        name=property_.title or property_.name or "Entire place",
        capacity=max(1, capacity),
        base_price=max(1, nightly_price),
        inventory_count=1,
        active=True,
        images=property_.gallery or ([property_.image_url] if property_.image_url else []),
    )
    db.add(room)
    db.flush()
    return [room]


def overlapping_bookings_query(db: Session, room_id: int, check_in: date, check_out: date, *, lock: bool = False):
    query = (
        db.query(Booking)
        .filter(Booking.room_id == room_id)
        .filter(Booking.deleted_at.is_(None))
        .filter(Booking.status.in_(BLOCKING_STATUSES))
        .filter(Booking.check_in < check_out)
        .filter(Booking.check_out > check_in)
    )
    if lock:
        query = query.with_for_update()
    return query


def date_range(check_in: date, check_out: date) -> list[date]:
    return [check_in.fromordinal(day) for day in range(check_in.toordinal(), check_out.toordinal())]


def calendar_capacity(db: Session, *, room: Room, check_in: date, check_out: date, lock: bool = False) -> int:
    nights = (check_out - check_in).days
    query = (
        db.query(AvailabilityCalendar)
        .filter(AvailabilityCalendar.property_id == room.property_id)
        .filter(AvailabilityCalendar.deleted_at.is_(None))
        .filter(AvailabilityCalendar.calendar_date >= check_in)
        .filter(AvailabilityCalendar.calendar_date < check_out)
        .filter(or_(AvailabilityCalendar.room_id == room.id, AvailabilityCalendar.room_id.is_(None)))
    )
    if lock:
        query = query.with_for_update()
    rows_by_date: dict[date, list[AvailabilityCalendar]] = {}
    for row in query.all():
        rows_by_date.setdefault(row.calendar_date, []).append(row)

    capacity = room.inventory_count
    for day in date_range(check_in, check_out):
        rows = rows_by_date.get(day, [])
        if not rows:
            continue
        if any(row.closed for row in rows):
            return 0
        if any(row.min_nights > nights for row in rows):
            return 0
        capacity = min(capacity, *(row.available_units for row in rows))
    return max(0, capacity)


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
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at or not property_.is_active:
        return None, 0
    ensure_bookable_rooms(db, property_, lock=lock)

    query = db.query(Room).filter(Room.property_id == property_id, Room.active.is_(True), Room.deleted_at.is_(None), Room.capacity >= guests)
    if room_id:
        query = query.filter(Room.id == room_id)
    if lock:
        query = query.with_for_update()
    rooms = query.order_by(Room.base_price.asc()).all()

    for room in rooms:
        overlapping_query = overlapping_bookings_query(db, room.id, check_in, check_out, lock=lock)
        used = len(overlapping_query.all()) if lock else overlapping_query.count()
        remaining = max(0, calendar_capacity(db, room=room, check_in=check_in, check_out=check_out, lock=lock) - used)
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

