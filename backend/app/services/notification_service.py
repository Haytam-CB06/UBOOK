from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Notification, User


def create_notification(
    db: Session,
    *,
    notification_type: str,
    subject: str,
    body: str,
    user: User | None = None,
    email: str | None = None,
    channel: str = "in_app",
    delivered: bool = True,
) -> Notification:
    notification = Notification(
        user_id=user.id if user else None,
        email=email or (user.email if user else None),
        notification_type=notification_type,
        subject=subject,
        body=body,
        channel=channel,
        delivered_at=datetime.now(timezone.utc) if delivered else None,
    )
    db.add(notification)
    return notification


def booking_confirmation(db: Session, *, email: str, booking_reference: str) -> None:
    create_notification(
        db,
        notification_type="booking_confirmation",
        subject=f"Booking {booking_reference} confirmed",
        body="Your UBOOK stay is confirmed. Arrival instructions will be available in your dashboard.",
        email=email,
    )


def booking_created(db: Session, *, email: str, booking_reference: str) -> None:
    create_notification(
        db,
        notification_type="booking_created",
        subject=f"Booking {booking_reference} created",
        body="Your UBOOK booking request is pending confirmation. Payment and host status will stay attached to your trip timeline.",
        email=email,
    )


def password_reset(db: Session, *, email: str, token: str) -> None:
    create_notification(
        db,
        notification_type="password_reset",
        subject="Reset your UBOOK password",
        body=f"Use this reset token within the configured expiry window: {token}",
        email=email,
    )
