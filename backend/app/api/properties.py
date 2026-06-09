from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_optional_user, require_roles
from app.core.cache import cache
from app.core.database import get_db
from app.models import Amenity, AvailabilityCalendar, Booking, Hotel, Property, PropertyImage, PropertyKind, Role, Room, User
from app.schemas.platform import CalendarBulkUpdate, PropertyImageCreate, PropertyImageReorder
from app.schemas.property import AvailabilityRequest, HotelCreate, PricingRequest, PropertyCreate, RoomCreate
from app.services.availability_service import BLOCKING_STATUSES, HOST_CALENDAR_STATUSES, availability_payload, ensure_bookable_rooms, find_available_room
from app.services.pricing_service import calculate_price
from app.services.serialization import property_to_frontend

router = APIRouter(tags=["properties"])


def _kind(value: str | None) -> PropertyKind:
    normalized = (value or "hotel").strip().lower()
    aliases = {"riyad": "riad", "property owner": "hotel"}
    normalized = aliases.get(normalized, normalized)
    if normalized in PropertyKind.__members__:
        return PropertyKind(normalized)
    return PropertyKind.hotel


def _get_or_create_amenities(db: Session, names: list[str]) -> list[Amenity]:
    amenities: list[Amenity] = []
    for name in names:
        existing = db.query(Amenity).filter(Amenity.name == name).first()
        if existing:
            amenities.append(existing)
        else:
            amenity = Amenity(name=name)
            db.add(amenity)
            db.flush()
            amenities.append(amenity)
    return amenities


def _query_properties(db: Session):
    return (
        db.query(Property)
        .options(
            joinedload(Property.amenities),
            joinedload(Property.rooms).joinedload(Room.room_type),
            joinedload(Property.reviews),
            joinedload(Property.property_images),
            joinedload(Property.owner).joinedload(User.host_profile),
            joinedload(Property.availability_calendar),
        )
        .filter(Property.deleted_at.is_(None))
    )


def _owned_property(db: Session, property_id: int, user: User) -> Property:
    property_ = _query_properties(db).filter(Property.id == property_id).first()
    if not property_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if user.role == Role.hotel_admin and property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot manage another owner's property")
    return property_


def _sync_property_images(db: Session, property_: Property, image_urls: list[str], cover_url: str | None) -> None:
    db.query(PropertyImage).filter(PropertyImage.property_id == property_.id).delete()
    db.flush()
    ordered_urls: list[str] = []
    for url in [cover_url, *image_urls]:
        if url and url not in ordered_urls:
            ordered_urls.append(url)
    for index, url in enumerate(ordered_urls):
        db.add(
            PropertyImage(
                property_id=property_.id,
                url=url,
                alt_text=property_.title or property_.name,
                sort_order=index,
                is_cover=index == 0,
            )
        )


def _dates_between(start: date, end: date) -> list[date]:
    cursor = start
    values: list[date] = []
    while cursor <= end:
        values.append(cursor)
        cursor += timedelta(days=1)
    return values


def _can_manage_property(user: User | None, property_: Property) -> bool:
    if not user:
        return False
    if user.role in {Role.admin, Role.super_admin}:
        return True
    return user.role == Role.hotel_admin and property_.owner_id == user.id


def _public_reservation_calendar(db: Session, property_: Property, start: date, end: date, user: User | None) -> list[dict]:
    active_rooms = ensure_bookable_rooms(db, property_)
    total_units = sum(room.inventory_count for room in active_rooms)
    room_capacity = {room.id: room.inventory_count for room in active_rooms}
    calendar_rows = (
        db.query(AvailabilityCalendar)
        .filter(
            AvailabilityCalendar.property_id == property_.id,
            AvailabilityCalendar.deleted_at.is_(None),
            AvailabilityCalendar.calendar_date >= start,
            AvailabilityCalendar.calendar_date <= end,
        )
        .all()
    )
    rows_by_date: dict[date, list[AvailabilityCalendar]] = {}
    for row in calendar_rows:
        rows_by_date.setdefault(row.calendar_date, []).append(row)

    can_manage = _can_manage_property(user, property_)
    calendar_statuses = HOST_CALENDAR_STATUSES if can_manage else BLOCKING_STATUSES
    reservations = (
        db.query(Booking)
        .filter(
            Booking.property_id == property_.id,
            Booking.deleted_at.is_(None),
            Booking.status.in_(calendar_statuses),
            Booking.check_in < end + timedelta(days=1),
            Booking.check_out > start,
        )
        .order_by(Booking.check_in.asc())
        .all()
    )
    today = date.today()
    days: list[dict] = []

    for day in _dates_between(start, end):
        rows = rows_by_date.get(day, [])
        closed = any(row.closed for row in rows)
        room_rows = [row for row in rows if row.room_id is not None]
        global_rows = [row for row in rows if row.room_id is None]
        configured_units = total_units
        if room_rows:
            configured_units = sum(0 if row.closed else row.available_units for row in room_rows)
        elif global_rows:
            configured_units = min(row.available_units for row in global_rows if not row.closed) if not closed else 0

        day_reservations = [booking for booking in reservations if booking.check_in <= day < booking.check_out]
        day_blocking_reservations = [booking for booking in day_reservations if booking.status in BLOCKING_STATUSES]
        reserved_units = sum(room_capacity.get(booking.room_id or -1, 1) for booking in day_blocking_reservations)
        available_units = max(0, configured_units - reserved_units)
        is_past = day < today
        available = not is_past and not closed and available_units > 0
        has_requests = any(booking.status not in BLOCKING_STATUSES for booking in day_reservations)
        status_label = (
            "past"
            if is_past
            else "blocked"
            if closed
            else "reserved"
            if day_blocking_reservations and available_units == 0
            else "limited"
            if day_blocking_reservations
            else "requested"
            if can_manage and has_requests
            else "available"
        )

        payload = {
            "date": day.isoformat(),
            "available": available,
            "status": status_label,
            "availableUnits": available_units,
            "reservedUnits": reserved_units,
            "totalUnits": total_units,
            "closed": closed,
            "minNights": max([row.min_nights for row in rows], default=1),
            "priceOverride": float(rows[0].price_override) if rows and rows[0].price_override is not None else None,
        }
        if can_manage:
            payload["reservations"] = [
                {
                    "id": booking.id,
                    "bookingReference": booking.booking_reference,
                    "guestName": booking.user.full_name if booking.user else booking.full_name,
                    "guestEmail": booking.user.email if booking.user else booking.email,
                    "checkIn": booking.check_in.isoformat(),
                    "checkOut": booking.check_out.isoformat(),
                    "status": booking.status.value,
                    "total": float(booking.total_amount),
                }
                for booking in day_reservations
            ]
        days.append(payload)

    return days


def _property_fields(payload: PropertyCreate, user: User) -> dict:
    name = payload.title or payload.name
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Property title is required")
    kind = _kind(payload.property_type or payload.type)
    nightly_price = payload.price_per_night if payload.price_per_night is not None else payload.price
    if nightly_price is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="pricePerNight is required")
    max_guests = payload.max_guests if payload.max_guests is not None else payload.capacity
    if max_guests is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="maxGuests is required")
    location = payload.location or payload.address or payload.city
    neighborhood = payload.neighborhood or payload.city
    host_name = payload.host or user.full_name
    cover_image = payload.image or (payload.gallery[0] if payload.gallery else "")
    search_vector = " ".join([name, payload.city, payload.country, location, neighborhood, payload.description, kind.value]).lower()
    return {
        "name": name,
        "title": name,
        "kind": kind,
        "property_type": kind.value,
        "city": payload.city,
        "country": payload.country,
        "address": payload.address or location,
        "location": location,
        "neighborhood": neighborhood,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "base_price": nightly_price,
        "price_per_night": nightly_price,
        "cleaning_fee": payload.cleaning_fee,
        "service_fee": payload.service_fee,
        "capacity": max_guests,
        "max_guests": max_guests,
        "bedrooms": payload.bedrooms,
        "bathrooms": payload.bathrooms,
        "beds": payload.beds,
        "description": payload.description,
        "image_url": cover_image,
        "gallery": payload.gallery,
        "tags": payload.tags,
        "host_name": host_name,
        "verified": payload.verified,
        "is_active": payload.is_active,
        "available_from": payload.available_from,
        "dynamic_pricing_note": payload.dynamic_pricing_note,
        "search_vector": search_vector,
    }


@router.get("/properties")
def list_properties(
    destination: str | None = None,
    type: str | None = None,
    country: str | None = None,
    city: str | None = None,
    property_type: str | None = Query(default=None, alias="propertyType"),
    guests: int | None = Query(default=None, ge=1),
    bedrooms: int | None = Query(default=None, ge=0),
    bathrooms: float | None = Query(default=None, ge=0),
    min_rating: float | None = Query(default=None, alias="minRating"),
    min_price: float | None = Query(default=None, alias="minPrice"),
    max_price: float | None = Query(default=None, alias="maxPrice"),
    check_in: date | None = Query(default=None, alias="checkIn"),
    check_out: date | None = Query(default=None, alias="checkOut"),
    amenity: list[str] | None = Query(default=None),
    sort: str = "recommended",
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    cache_key = f"search:properties:{destination}:{type}:{country}:{city}:{property_type}:{guests}:{bedrooms}:{bathrooms}:{min_rating}:{min_price}:{max_price}:{check_in}:{check_out}:{amenity}:{sort}:{page}:{size}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    query = _query_properties(db).filter(Property.is_active.is_(True))
    if destination:
        search = f"%{destination.lower()}%"
        query = query.filter(
            or_(
                Property.city.ilike(search),
                Property.country.ilike(search),
                Property.location.ilike(search),
                Property.neighborhood.ilike(search),
                Property.search_vector.ilike(search),
            )
        )
    if country:
        query = query.filter(Property.country.ilike(f"%{country}%"))
    if city:
        query = query.filter(Property.city.ilike(f"%{city}%"))
    requested_type = property_type or type
    if requested_type and requested_type.lower() != "all":
        query = query.filter(Property.kind == _kind(requested_type))
    if guests:
        query = query.filter(func.coalesce(Property.max_guests, Property.capacity) >= guests)
    if bedrooms is not None:
        query = query.filter(Property.bedrooms >= bedrooms)
    if bathrooms is not None:
        query = query.filter(Property.bathrooms >= bathrooms)
    if min_rating is not None:
        query = query.filter(func.coalesce(Property.average_rating, Property.rating) >= min_rating)
    if min_price is not None:
        query = query.filter(func.coalesce(Property.price_per_night, Property.base_price) >= min_price)
    if max_price is not None:
        query = query.filter(func.coalesce(Property.price_per_night, Property.base_price) <= max_price)
    if amenity:
        for item in amenity:
            query = query.filter(Property.amenities.any(Amenity.name.ilike(f"%{item}%")))

    if sort in {"price-low", "price"}:
        query = query.order_by(func.coalesce(Property.price_per_night, Property.base_price).asc())
    elif sort == "price-high":
        query = query.order_by(func.coalesce(Property.price_per_night, Property.base_price).desc())
    elif sort == "rating":
        query = query.order_by(func.coalesce(Property.average_rating, Property.rating).desc())
    elif sort in {"newest", "new"}:
        query = query.order_by(Property.created_at.desc())
    elif sort in {"popular", "most-popular"}:
        query = query.order_by(Property.review_count.desc(), Property.created_at.desc())
    else:
        query = query.order_by(Property.verified.desc(), func.coalesce(Property.average_rating, Property.rating).desc(), Property.review_count.desc())

    results = query.offset((page - 1) * size).limit(size).all()
    if check_in and check_out:
        results = [
            item
            for item in results
            if find_available_room(db, property_id=item.id, check_in=check_in, check_out=check_out, guests=guests or 1)[0]
        ]
    payload = [property_to_frontend(item) for item in results]
    cache.set_json(cache_key, payload, ttl_seconds=120)
    return payload


@router.post("/properties", status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    fields = _property_fields(payload, user)
    property_ = Property(owner_id=user.id, **fields)
    property_.amenities = _get_or_create_amenities(db, payload.amenities)
    db.add(property_)
    db.flush()
    _sync_property_images(db, property_, payload.gallery, fields["image_url"])
    ensure_bookable_rooms(db, property_)
    if user.role == Role.hotel_admin and user.host_profile and not user.host_profile.onboarding_completed_at:
        from app.core.security import now_utc

        user.host_profile.onboarding_completed_at = now_utc()
    db.commit()
    db.refresh(property_)
    cache.delete_prefix("search:properties")
    return property_to_frontend(property_)


@router.get("/properties/{property_id}")
def get_property(property_id: int, db: Session = Depends(get_db)):
    property_ = _query_properties(db).filter(Property.id == property_id).first()
    if not property_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return property_to_frontend(property_)


@router.put("/properties/{property_id}")
def update_property(
    property_id: int,
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if user.role == Role.hotel_admin and property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another owner's property")
    fields = _property_fields(payload, user)
    for key, value in fields.items():
        setattr(property_, key, value)
    property_.amenities = _get_or_create_amenities(db, payload.amenities)
    _sync_property_images(db, property_, payload.gallery, fields["image_url"])
    ensure_bookable_rooms(db, property_)
    db.commit()
    cache.delete_prefix("search:properties")
    return property_to_frontend(property_)


@router.delete("/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if user.role == Role.hotel_admin and property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another owner's property")
    from app.core.security import now_utc

    property_.deleted_at = now_utc()
    db.commit()
    cache.delete_prefix("search:properties")


@router.post("/properties/{property_id}/availability")
def check_availability(property_id: int, payload: AvailabilityRequest, db: Session = Depends(get_db)):
    return availability_payload(db, property_id=property_id, check_in=payload.check_in, check_out=payload.check_out, guests=payload.guests)


@router.get("/properties/{property_id}/availability")
def get_availability(
    property_id: int,
    check_in: date | None = Query(default=None, alias="check_in"),
    check_out: date | None = Query(default=None, alias="check_out"),
    check_in_camel: date | None = Query(default=None, alias="checkIn"),
    check_out_camel: date | None = Query(default=None, alias="checkOut"),
    guests: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
):
    resolved_check_in = check_in or check_in_camel
    resolved_check_out = check_out or check_out_camel
    if not resolved_check_in or not resolved_check_out:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="check_in and check_out are required")
    return availability_payload(db, property_id=property_id, check_in=resolved_check_in, check_out=resolved_check_out, guests=guests)


@router.get("/properties/{property_id}/reservations/calendar")
def get_reservation_calendar(
    property_id: int,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    property_ = _query_properties(db).filter(Property.id == property_id).first()
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    today = date.today()
    resolved_start = start or today
    resolved_end = end or resolved_start + timedelta(days=89)
    if resolved_end < resolved_start:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end must be after start")
    return _public_reservation_calendar(db, property_, resolved_start, resolved_end, user)


@router.get("/properties/{property_id}/calendar")
def get_property_calendar(
    property_id: int,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = _owned_property(db, property_id, user)
    query = db.query(AvailabilityCalendar).filter(AvailabilityCalendar.property_id == property_.id, AvailabilityCalendar.deleted_at.is_(None))
    if start:
        query = query.filter(AvailabilityCalendar.calendar_date >= start)
    if end:
        query = query.filter(AvailabilityCalendar.calendar_date <= end)
    rows = query.order_by(AvailabilityCalendar.calendar_date.asc()).all()
    return [_calendar_payload(row) for row in rows]


@router.put("/properties/{property_id}/calendar")
def update_property_calendar(
    property_id: int,
    payload: CalendarBulkUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = _owned_property(db, property_id, user)
    valid_room_ids = {room.id for room in property_.rooms if room.deleted_at is None}
    updated: list[AvailabilityCalendar] = []
    for row in payload.rows:
        if row.room_id is not None and row.room_id not in valid_room_ids:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Room {row.room_id} does not belong to this property")
        calendar_row = (
            db.query(AvailabilityCalendar)
            .filter(
                AvailabilityCalendar.property_id == property_.id,
                AvailabilityCalendar.room_id.is_(row.room_id) if row.room_id is None else AvailabilityCalendar.room_id == row.room_id,
                AvailabilityCalendar.calendar_date == row.calendar_date,
            )
            .first()
        )
        if not calendar_row:
            calendar_row = AvailabilityCalendar(property_id=property_.id, room_id=row.room_id, calendar_date=row.calendar_date, available_units=row.available_units)
            db.add(calendar_row)
        calendar_row.available_units = row.available_units
        calendar_row.min_nights = row.min_nights
        calendar_row.closed = row.closed
        calendar_row.price_override = row.price_override
        updated.append(calendar_row)
    db.commit()
    for row in updated:
        db.refresh(row)
    cache.delete_prefix("search:properties")
    return [_calendar_payload(row) for row in updated]


@router.post("/properties/{property_id}/images", status_code=status.HTTP_201_CREATED)
def add_property_image(
    property_id: int,
    payload: PropertyImageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = _owned_property(db, property_id, user)
    if payload.is_cover:
        for image in property_.property_images:
            image.is_cover = False
        property_.image_url = payload.url
    next_sort = max([item.sort_order for item in property_.property_images if item.deleted_at is None], default=-1) + 1
    image = PropertyImage(property_id=property_.id, url=payload.url, alt_text=payload.alt_text, sort_order=next_sort, is_cover=payload.is_cover)
    db.add(image)
    property_.gallery = [item.url for item in sorted([*property_.property_images, image], key=lambda item: item.sort_order)]
    db.commit()
    db.refresh(image)
    cache.delete_prefix("search:properties")
    return {"id": image.id, "url": image.url, "sortOrder": image.sort_order, "isCover": image.is_cover}


@router.patch("/properties/{property_id}/images/reorder")
def reorder_property_images(
    property_id: int,
    payload: PropertyImageReorder,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = _owned_property(db, property_id, user)
    images = {image.id: image for image in property_.property_images if image.deleted_at is None}
    if set(payload.image_ids) != set(images):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="imageIds must include every active property image")
    for offset, image in enumerate(images.values(), start=1000):
        image.sort_order = offset
    db.flush()
    for index, image_id in enumerate(payload.image_ids):
        images[image_id].sort_order = index
    property_.gallery = [images[image_id].url for image_id in payload.image_ids]
    db.commit()
    cache.delete_prefix("search:properties")
    return property_to_frontend(property_)


@router.delete("/properties/{property_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property_image(
    property_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
):
    property_ = _owned_property(db, property_id, user)
    image = next((item for item in property_.property_images if item.id == image_id and item.deleted_at is None), None)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    from app.core.security import now_utc

    image.deleted_at = now_utc()
    active = [item for item in property_.property_images if item.id != image_id and item.deleted_at is None]
    if image.is_cover and active:
        active[0].is_cover = True
        property_.image_url = active[0].url
    property_.gallery = [item.url for item in sorted(active, key=lambda item: item.sort_order)]
    db.commit()
    cache.delete_prefix("search:properties")


@router.post("/properties/{property_id}/pricing")
def property_pricing(property_id: int, payload: PricingRequest, db: Session = Depends(get_db)):
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return calculate_price(db, property_=property_, check_in=payload.check_in, check_out=payload.check_out, nights=payload.nights, guests=payload.guests)


@router.get("/hotels")
def list_hotels(db: Session = Depends(get_db)):
    return db.query(Hotel).filter(Hotel.deleted_at.is_(None)).order_by(Hotel.name.asc()).all()


@router.post("/hotels", status_code=status.HTTP_201_CREATED)
def create_hotel(payload: HotelCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    hotel = Hotel(owner_id=user.id, **payload.model_dump(by_alias=False))
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return hotel


@router.get("/hotels/{hotel_id}")
def get_hotel(hotel_id: int, db: Session = Depends(get_db)):
    hotel = db.get(Hotel, hotel_id)
    if not hotel or hotel.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
    return hotel


@router.put("/hotels/{hotel_id}")
def update_hotel(hotel_id: int, payload: HotelCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    hotel = db.get(Hotel, hotel_id)
    if not hotel or hotel.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
    if user.role == Role.hotel_admin and hotel.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another owner's hotel")
    for key, value in payload.model_dump(by_alias=False).items():
        setattr(hotel, key, value)
    db.commit()
    return hotel


@router.delete("/hotels/{hotel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hotel(hotel_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    hotel = db.get(Hotel, hotel_id)
    if not hotel or hotel.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
    from app.core.security import now_utc

    hotel.deleted_at = now_utc()
    db.commit()


@router.get("/properties/{property_id}/rooms")
def list_property_rooms(property_id: int, db: Session = Depends(get_db)):
    rooms = db.query(Room).filter(Room.property_id == property_id, Room.deleted_at.is_(None)).all()
    return [_room_payload(room) for room in rooms]


def _room_payload(room: Room) -> dict:
    return {
        "id": room.id,
        "propertyId": room.property_id,
        "roomTypeId": room.room_type_id,
        "roomNumber": room.room_number,
        "name": room.name,
        "capacity": room.capacity,
        "basePrice": float(room.base_price),
        "inventoryCount": room.inventory_count,
        "active": room.active,
        "images": room.images,
        "amenities": [amenity.name for amenity in room.amenities],
    }


def _calendar_payload(row: AvailabilityCalendar) -> dict:
    return {
        "id": row.id,
        "propertyId": row.property_id,
        "roomId": row.room_id,
        "calendarDate": row.calendar_date.isoformat(),
        "availableUnits": row.available_units,
        "minNights": row.min_nights,
        "closed": row.closed,
        "priceOverride": float(row.price_override) if row.price_override is not None else None,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }


@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db)):
    return [_room_payload(room) for room in db.query(Room).filter(Room.deleted_at.is_(None)).all()]


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    property_ = db.get(Property, payload.property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if user.role == Role.hotel_admin and property_.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot add rooms to another owner's property")
    room = Room(
        property_id=payload.property_id,
        room_type_id=payload.room_type_id,
        room_number=payload.room_number,
        name=payload.name,
        capacity=payload.capacity,
        base_price=payload.base_price,
        inventory_count=payload.inventory_count,
        images=payload.images,
    )
    room.amenities = _get_or_create_amenities(db, payload.amenities)
    db.add(room)
    db.commit()
    db.refresh(room)
    cache.delete_prefix("search:properties")
    return _room_payload(room)


@router.put("/rooms/{room_id}")
def update_room(room_id: int, payload: RoomCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    room = db.get(Room, room_id)
    if not room or room.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    if user.role == Role.hotel_admin and room.property.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another owner's room")
    room.property_id = payload.property_id
    room.room_type_id = payload.room_type_id
    room.room_number = payload.room_number
    room.name = payload.name
    room.capacity = payload.capacity
    room.base_price = payload.base_price
    room.inventory_count = payload.inventory_count
    room.images = payload.images
    room.amenities = _get_or_create_amenities(db, payload.amenities)
    db.commit()
    cache.delete_prefix("search:properties")
    return _room_payload(room)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin))):
    room = db.get(Room, room_id)
    if not room or room.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    if user.role == Role.hotel_admin and room.property.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another owner's room")
    from app.core.security import now_utc

    room.deleted_at = now_utc()
    db.commit()
    cache.delete_prefix("search:properties")


@router.get("/amenities")
def list_amenities(db: Session = Depends(get_db)):
    return db.query(Amenity).filter(Amenity.deleted_at.is_(None)).order_by(Amenity.name.asc()).all()
