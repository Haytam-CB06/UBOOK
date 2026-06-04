from __future__ import annotations

from datetime import date, timedelta

from app.models import Booking, Property, Review, Room


KIND_LABELS = {
    "riad": "Riad",
    "apartment": "Apartment",
    "house": "House",
    "hotel": "Hotel",
    "villa": "Villa",
    "resort": "Resort",
    "cabin": "Cabin",
}


def review_to_frontend(review: Review) -> dict:
    return {
        "id": review.id,
        "author": review.author_name,
        "role": review.role_label,
        "avatar": review.avatar_url,
        "rating": review.rating,
        "comment": review.comment,
    }


def room_option_to_frontend(room: Room) -> dict:
    return {
        "id": str(room.id),
        "name": room.name,
        "description": room.room_type.description if room.room_type else f"Room {room.room_number}",
        "priceModifier": float(room.room_type.base_price_modifier if room.room_type else 0),
        "sleeps": room.capacity,
    }


def availability_from_calendar(property_: Property) -> list[dict[str, str]]:
    slots: list[dict[str, str]] = []
    for row in sorted(property_.availability_calendar, key=lambda item: item.calendar_date):
        if row.closed or row.available_units == 0:
            status = "Closed"
        elif row.available_units <= 2:
            status = "Limited"
        else:
            status = "Open"
        slots.append(
            {
                "label": row.calendar_date.isoformat(),
                "status": status,
                "availableUnits": row.available_units,
                "minNights": row.min_nights,
                "priceOverride": float(row.price_override) if row.price_override is not None else None,
            }
        )
    return slots


def property_to_frontend(property_: Property) -> dict:
    ordered_images = [image.url for image in property_.property_images if image.deleted_at is None]
    gallery = ordered_images or property_.gallery
    cover_image = next((image.url for image in property_.property_images if image.is_cover and image.deleted_at is None), None)
    nightly_price = property_.price_per_night if property_.price_per_night is not None else property_.base_price
    max_guests = property_.max_guests if property_.max_guests is not None else property_.capacity
    host = property_.owner
    return {
        "id": property_.id,
        "name": property_.title or property_.name,
        "title": property_.title or property_.name,
        "type": KIND_LABELS.get(property_.kind.value, property_.kind.value.title()),
        "propertyType": property_.property_type or property_.kind.value,
        "country": property_.country,
        "city": property_.city,
        "address": property_.address or property_.location,
        "location": property_.location,
        "neighborhood": property_.neighborhood,
        "coordinates": [property_.latitude, property_.longitude],
        "price": float(nightly_price),
        "pricePerNight": float(nightly_price),
        "cleaningFee": float(property_.cleaning_fee),
        "serviceFee": float(property_.service_fee),
        "rating": round(float(property_.average_rating or property_.rating), 1),
        "averageRating": round(float(property_.average_rating or property_.rating), 1),
        "reviewCount": property_.review_count,
        "image": cover_image or property_.image_url,
        "coverImage": cover_image or property_.image_url,
        "gallery": gallery,
        "amenities": [amenity.name for amenity in property_.amenities],
        "capacity": max_guests,
        "maxGuests": max_guests,
        "bedrooms": property_.bedrooms,
        "bathrooms": property_.bathrooms,
        "beds": property_.beds,
        "description": property_.description,
        "tags": property_.tags,
        "host": host.full_name if host else property_.host_name,
        "hostId": property_.owner_id,
        "hostAvatar": host.avatar_url if host else None,
        "hostSince": host.created_at.isoformat() if host else None,
        "hostRating": round(float(host.host_profile.average_rating), 1) if host and host.host_profile else 0,
        "hostReviewsCount": host.host_profile.review_count if host and host.host_profile else 0,
        "verified": property_.verified,
        "isActive": property_.is_active,
        "availableFrom": property_.available_from.isoformat() if property_.available_from else None,
        "createdAt": property_.created_at.isoformat(),
        "updatedAt": property_.updated_at.isoformat(),
        "dynamicPricingNote": property_.dynamic_pricing_note,
        "roomOptions": [room_option_to_frontend(room) for room in property_.rooms],
        "availability": availability_from_calendar(property_),
        "reviews": [review_to_frontend(review) for review in property_.reviews if review.deleted_at is None],
    }


def booking_to_frontend(booking: Booking) -> dict:
    nights = (booking.check_out - booking.check_in).days
    return {
        "id": booking.id,
        "bookingId": booking.booking_reference,
        "bookingReference": booking.booking_reference,
        "propertyId": booking.property_id,
        "propertyName": booking.property.name,
        "propertyTitle": booking.property.title or booking.property.name,
        "propertyImage": booking.property.image_url,
        "hostId": booking.property.owner_id,
        "hostName": booking.property.owner.full_name if booking.property.owner else booking.property.host_name,
        "city": booking.property.city,
        "dates": f"{booking.check_in.strftime('%d %b')} - {booking.check_out.strftime('%d %b')}",
        "nights": nights,
        "status": booking.status.value.replace("_", "-").title(),
        "total": float(booking.total_amount),
        "payload": {
            "propertyId": booking.property_id,
            "fullName": booking.full_name,
            "email": booking.email,
            "guests": booking.guests,
            "checkIn": booking.check_in.isoformat(),
            "checkOut": booking.check_out.isoformat(),
            "notes": booking.notes,
        },
    }


def date_range(start: date, end: date) -> list[date]:
    cursor = start
    values: list[date] = []
    while cursor < end:
        values.append(cursor)
        cursor += timedelta(days=1)
    return values
