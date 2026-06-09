from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Favorite, Notification, Payment, PaymentStatus, Property, Review, Role, SupportTicket, TravelerReview, User, Wishlist
from app.services.serialization import booking_to_frontend, property_to_frontend


def _money(value: float | int | None) -> str:
    return f"${round(float(value or 0), 2)}"


def traveler_dashboard(db: Session, user: User) -> dict:
    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == user.id, Booking.deleted_at.is_(None))
        .order_by(Booking.check_in.asc())
        .all()
    )
    upcoming = [booking for booking in bookings if booking.check_out >= date.today() and booking.status not in {BookingStatus.cancelled, BookingStatus.rejected, BookingStatus.refunded}]
    favorites = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.deleted_at.is_(None)).count()
    wishlists = db.query(Wishlist).filter(Wishlist.user_id == user.id, Wishlist.deleted_at.is_(None)).count()
    received_reviews = db.query(TravelerReview).filter(TravelerReview.traveler_id == user.id, TravelerReview.deleted_at.is_(None)).all()
    average_rating = round(sum(review.rating for review in received_reviews) / len(received_reviews), 1) if received_reviews else 0
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.deleted_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(10)
        .all()
    )
    recommended = (
        db.query(Property)
        .filter(Property.deleted_at.is_(None), Property.is_active.is_(True))
        .order_by(Property.average_rating.desc(), Property.review_count.desc(), Property.created_at.desc())
        .limit(6)
        .all()
    )
    booking_count_by_property: dict[int, int] = defaultdict(int)
    revenue_by_property: dict[int, float] = defaultdict(float)
    for booking in bookings:
        booking_count_by_property[booking.property_id] += 1
        if booking.status in {BookingStatus.confirmed, BookingStatus.completed, BookingStatus.checked_in, BookingStatus.checked_out}:
            revenue_by_property[booking.property_id] += float(booking.total_amount)

    return {
        "metrics": [
            {"label": "Upcoming Trips", "value": str(len(upcoming)), "detail": "Bookings that have not ended"},
            {"label": "Favorites", "value": str(favorites), "detail": "Saved properties"},
            {"label": "Wishlists", "value": str(wishlists), "detail": "Personal trip lists"},
            {"label": "Rating Received", "value": str(average_rating), "detail": f"{len(received_reviews)} host reviews"},
        ],
        "upcomingTrips": [booking_to_frontend(booking) for booking in upcoming],
        "bookingHistory": [booking_to_frontend(booking) for booking in bookings],
        "notifications": [_notification_payload(item) for item in notifications],
        "recommendedProperties": [property_to_frontend(property_) for property_ in recommended],
    }


def host_dashboard(db: Session, user: User) -> dict:
    properties = db.query(Property).filter(Property.owner_id == user.id, Property.deleted_at.is_(None)).all()
    property_ids = [property_.id for property_ in properties]
    bookings = (
        db.query(Booking)
        .filter(Booking.property_id.in_(property_ids), Booking.deleted_at.is_(None))
        .order_by(Booking.created_at.desc())
        .all()
        if property_ids
        else []
    )
    completed_revenue = sum(float(booking.total_amount) for booking in bookings if booking.status in {BookingStatus.confirmed, BookingStatus.completed, BookingStatus.checked_in, BookingStatus.checked_out})
    paid_revenue = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == PaymentStatus.succeeded, Payment.booking_id.in_([booking.id for booking in bookings]))
        .scalar()
        if bookings
        else 0
    )
    reviews = db.query(Review).filter(Review.property_id.in_(property_ids), Review.deleted_at.is_(None)).all() if property_ids else []
    avg_rating = round(sum(review.rating for review in reviews) / len(reviews), 1) if reviews else 0
    active = len([property_ for property_ in properties if property_.is_active and property_.deleted_at is None])
    occupancy_rate = _host_occupancy_rate(properties, bookings)
    booking_count_by_property: dict[int, int] = defaultdict(int)
    revenue_by_property: dict[int, float] = defaultdict(float)
    for booking in bookings:
        booking_count_by_property[booking.property_id] += 1
        if booking.status in {BookingStatus.confirmed, BookingStatus.completed, BookingStatus.checked_in, BookingStatus.checked_out}:
            revenue_by_property[booking.property_id] += float(booking.total_amount)
    return {
        "needsOnboarding": len(properties) == 0 and not (user.host_profile and user.host_profile.onboarding_completed_at),
        "hasActiveProperties": active > 0,
        "metrics": [
            {"label": "Total Listings", "value": str(len(properties)), "detail": "All non-deleted properties"},
            {"label": "Active Listings", "value": str(active), "detail": "Published and searchable"},
            {"label": "Bookings", "value": str(len(bookings)), "detail": "Reservations across listings"},
            {"label": "Revenue", "value": _money(paid_revenue or completed_revenue), "detail": "Succeeded payments first, confirmed bookings fallback"},
            {"label": "Occupancy Rate", "value": f"{occupancy_rate}%", "detail": "Booked room nights against available capacity"},
            {"label": "Average Rating", "value": str(avg_rating), "detail": f"{len(reviews)} property reviews"},
        ],
        "properties": [_host_property_payload(property_, booking_count_by_property, revenue_by_property) for property_ in properties],
        "recentReservations": [booking_to_frontend(booking) for booking in bookings[:10]],
        "recentReviews": [_review_payload(review) for review in reviews[:10]],
        "bookingTrends": _daily_booking_trends(bookings),
        "revenueTrends": _daily_revenue_trends(bookings),
        "notifications": [_notification_payload(item) for item in user.notifications[:10]],
        "tasks": _host_tasks(properties, bookings, reviews, user),
    }


def platform_stats(db: Session) -> dict:
    booking_count = db.query(Booking).filter(Booking.deleted_at.is_(None)).count()
    revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == PaymentStatus.succeeded).scalar() or 0
    property_count = db.query(Property).filter(Property.deleted_at.is_(None)).count()
    user_count = db.query(User).filter(User.deleted_at.is_(None)).count()
    host_count = db.query(User).filter(User.role == Role.hotel_admin, User.deleted_at.is_(None)).count()
    traveler_count = db.query(User).filter(User.role == Role.guest, User.deleted_at.is_(None)).count()
    active_properties = db.query(Property).filter(Property.deleted_at.is_(None), Property.is_active.is_(True)).count()
    bookings = db.query(Booking).filter(Booking.deleted_at.is_(None)).all()
    properties = db.query(Property).filter(Property.deleted_at.is_(None)).all()
    occupancy = _host_occupancy_rate(properties, bookings)
    return {
        "metrics": [
            {"label": "Users", "value": str(user_count), "change": f"{traveler_count} travelers / {host_count} hosts"},
            {"label": "Listings", "value": str(property_count), "change": f"{active_properties} active"},
            {"label": "Bookings", "value": str(booking_count), "change": f"{occupancy}% occupancy"},
            {"label": "Revenue", "value": _money(revenue), "change": "Succeeded payments"},
        ],
        "bookingMetrics": {"total": booking_count, "confirmed": _count_status(bookings, BookingStatus.confirmed), "cancelled": _count_status(bookings, BookingStatus.cancelled)},
        "revenueMetrics": {"grossRevenue": float(revenue), "paidBookings": db.query(Payment).filter(Payment.status == PaymentStatus.succeeded).count()},
        "propertyMetrics": {"total": property_count, "active": active_properties, "occupancyRate": occupancy},
        "userMetrics": {"total": user_count, "travelers": traveler_count, "hosts": host_count},
        "busyAreas": _busy_areas(properties, bookings),
        "occupancyOverview": _occupancy_by_city(properties, bookings),
        "pricingRules": _pricing_rule_summary(properties),
        "recentSearches": [],
        "operations": _platform_operations(db),
    }


def _count_status(bookings: list[Booking], status: BookingStatus) -> int:
    return len([booking for booking in bookings if booking.status == status])


def _host_occupancy_rate(properties: list[Property], bookings: list[Booking]) -> int:
    total_capacity = sum(max(property_.max_guests or property_.capacity, 1) for property_ in properties)
    if not total_capacity:
        return 0
    booked_guest_nights = sum(booking.traveler_count * max((booking.check_out - booking.check_in).days, 1) for booking in bookings if booking.status in {BookingStatus.confirmed, BookingStatus.checked_in, BookingStatus.checked_out, BookingStatus.completed})
    available_guest_nights = total_capacity * 30
    return min(100, round((booked_guest_nights / available_guest_nights) * 100)) if available_guest_nights else 0


def _daily_booking_trends(bookings: list[Booking]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for booking in bookings:
        counts[booking.created_at.date().isoformat()] += 1
    return [{"date": key, "bookings": value} for key, value in sorted(counts.items())]


def _daily_revenue_trends(bookings: list[Booking]) -> list[dict]:
    revenue: dict[str, float] = defaultdict(float)
    for booking in bookings:
        if booking.status in {BookingStatus.confirmed, BookingStatus.checked_in, BookingStatus.checked_out, BookingStatus.completed}:
            revenue[booking.created_at.date().isoformat()] += float(booking.total_amount)
    return [{"date": key, "revenue": round(value, 2)} for key, value in sorted(revenue.items())]


def _busy_areas(properties: list[Property], bookings: list[Booking]) -> list[dict]:
    by_property = defaultdict(list)
    for booking in bookings:
        by_property[booking.property_id].append(booking)
    areas = []
    for property_ in properties:
        occupancy = _host_occupancy_rate([property_], by_property[property_.id])
        areas.append(
            {
                "id": str(property_.id),
                "name": f"{property_.city} / {property_.neighborhood}",
                "coordinates": [property_.latitude, property_.longitude],
                "radius": max(800, occupancy * 75),
                "occupancyRate": occupancy,
                "intensity": "High" if occupancy >= 75 else "Growing" if occupancy >= 40 else "Emerging",
                "note": property_.title or property_.name,
            }
        )
    return areas


def _occupancy_by_city(properties: list[Property], bookings: list[Booking]) -> list[dict]:
    result = []
    for city in sorted({property_.city for property_ in properties}):
        city_properties = [property_ for property_ in properties if property_.city == city]
        city_ids = {property_.id for property_ in city_properties}
        city_bookings = [booking for booking in bookings if booking.property_id in city_ids]
        result.append({"label": city, "value": _host_occupancy_rate(city_properties, city_bookings)})
    return result


def _pricing_rule_summary(properties: list[Property]) -> list[str]:
    return [
        f"{property_.title or property_.name}: base {float(property_.price_per_night or property_.base_price):.2f}, cleaning {float(property_.cleaning_fee):.2f}, service {float(property_.service_fee):.2f}"
        for property_ in properties[:10]
    ]


def _notification_payload(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.notification_type,
        "subject": notification.subject,
        "body": notification.body,
        "readAt": notification.read_at.isoformat() if notification.read_at else None,
        "createdAt": notification.created_at.isoformat(),
    }


def _review_payload(review: Review) -> dict:
    return {
        "id": review.id,
        "propertyId": review.property_id,
        "author": review.author_name,
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.created_at.isoformat(),
    }


def _host_property_payload(property_: Property, booking_counts: dict[int, int], revenue: dict[int, float]) -> dict:
    payload = property_to_frontend(property_)
    payload["hostStats"] = {
        "bookingCount": booking_counts[property_.id],
        "revenue": round(revenue[property_.id], 2),
        "status": "Live" if property_.is_active else "Paused",
        "views": int((property_.review_count * 19) + booking_counts[property_.id] * 42 + max(property_.capacity, 1) * 8),
        "conversionRate": round(min(18, (booking_counts[property_.id] / max((property_.review_count * 19) + 50, 1)) * 100), 1),
    }
    return payload


def _host_tasks(properties: list[Property], bookings: list[Booking], reviews: list[Review], user: User) -> list[str]:
    tasks: list[str] = []
    pending = [booking for booking in bookings if booking.status == BookingStatus.pending]
    if pending:
        tasks.append(f"Review {len(pending)} pending reservation request{'s' if len(pending) != 1 else ''}.")
    inactive = [property_ for property_ in properties if not property_.is_active]
    if inactive:
        tasks.append(f"Publish or archive {len(inactive)} inactive listing{'s' if len(inactive) != 1 else ''}.")
    no_images = [property_ for property_ in properties if not property_.image_url and not property_.gallery]
    if no_images:
        tasks.append(f"Upload cover images for {len(no_images)} listing{'s' if len(no_images) != 1 else ''}.")
    unread_notifications = [item for item in user.notifications if item.deleted_at is None and item.read_at is None]
    if unread_notifications:
        tasks.append(f"Review {len(unread_notifications)} unread notification{'s' if len(unread_notifications) != 1 else ''}.")
    if reviews and min(review.rating for review in reviews) <= 3:
        tasks.append("Respond to recent low-rating guest feedback.")
    return tasks or ["No urgent host tasks. Keep pricing, availability, and response times current."]


def _platform_operations(db: Session) -> dict:
    open_support = db.query(SupportTicket).filter(SupportTicket.deleted_at.is_(None), SupportTicket.status.in_(["open", "pending", "review"])).count()
    return {"openSupportTickets": open_support}
