from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Booking, BookingStatus, HostProfile, Property, Role, User
from app.services.booking_service import transition_booking
from app.services.dashboard_service import host_dashboard
from app.services.notification_service import booking_confirmation
from app.services.serialization import booking_to_frontend, property_to_frontend

router = APIRouter(prefix="/host", tags=["host"])


def _host_reservations_query(db: Session, user: User):
    query = db.query(Booking).join(Booking.property).filter(Booking.deleted_at.is_(None), Property.deleted_at.is_(None))
    if user.role == Role.hotel_admin:
        query = query.filter(Property.owner_id == user.id)
    return query


def _host_reservation(db: Session, booking_id: int, user: User, *, lock: bool = False) -> Booking:
    query = _host_reservations_query(db, user).filter(Booking.id == booking_id)
    if lock:
        query = query.with_for_update()
    booking = query.first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return booking


@router.get("/onboarding")
def onboarding_status(user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    profile = user.host_profile
    if not profile:
        profile = HostProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    property_count = db.query(Property).filter(Property.owner_id == user.id, Property.deleted_at.is_(None)).count()
    return {
        "required": user.role == Role.hotel_admin and property_count == 0 and not profile.onboarding_completed_at,
        "completed": bool(profile.onboarding_completed_at),
        "exited": bool(profile.onboarding_exited_at),
        "propertyCount": property_count,
    }


@router.post("/onboarding/exit")
def exit_onboarding(user: User = Depends(require_roles(Role.hotel_admin)), db: Session = Depends(get_db)):
    profile = user.host_profile or HostProfile(user_id=user.id)
    if not user.host_profile:
        db.add(profile)
    profile.onboarding_exited_at = now_utc()
    db.commit()
    return {"ok": True}


@router.post("/onboarding/complete")
def complete_onboarding(user: User = Depends(require_roles(Role.hotel_admin)), db: Session = Depends(get_db)):
    profile = user.host_profile or HostProfile(user_id=user.id)
    if not user.host_profile:
        db.add(profile)
    profile.onboarding_completed_at = now_utc()
    db.commit()
    return {"ok": True}


@router.get("/dashboard")
def dashboard(user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    return host_dashboard(db, user)


@router.get("/properties")
def my_properties(user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    query = db.query(Property).filter(Property.deleted_at.is_(None)).order_by(Property.created_at.desc())
    if user.role == Role.hotel_admin:
        query = query.filter(Property.owner_id == user.id)
    return [property_to_frontend(property_) for property_ in query.all()]


@router.get("/reservations")
def host_reservations(user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    bookings = _host_reservations_query(db, user).order_by(Booking.created_at.desc()).all()
    return [booking_to_frontend(booking) for booking in bookings]


@router.patch("/reservations/{booking_id}/confirm")
def confirm_reservation(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    booking = _host_reservation(db, booking_id, user, lock=True)
    was_pending = booking.status == BookingStatus.pending
    transition_booking(db, booking=booking, to_status=BookingStatus.confirmed, actor=user, reason="host_confirm")
    if was_pending:
        booking_confirmation(db, email=booking.email, booking_reference=booking.booking_reference)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@router.patch("/reservations/{booking_id}/cancel")
def cancel_reservation(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    booking = _host_reservation(db, booking_id, user, lock=True)
    transition_booking(db, booking=booking, to_status=BookingStatus.cancelled, actor=user, reason="host_cancel")
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@router.patch("/reservations/{booking_id}/complete")
def complete_reservation(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    booking = _host_reservation(db, booking_id, user, lock=True)
    transition_booking(db, booking=booking, to_status=BookingStatus.completed, actor=user, reason="host_complete")
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@router.post("/bookings/{booking_id}/accept")
def accept_booking(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    booking = _host_reservation(db, booking_id, user, lock=True)
    was_pending = booking.status == BookingStatus.pending
    transition_booking(db, booking=booking, to_status=BookingStatus.confirmed, actor=user, reason="host_accept")
    if was_pending:
        booking_confirmation(db, email=booking.email, booking_reference=booking.booking_reference)
    db.commit()
    return {"ok": True}


@router.post("/bookings/{booking_id}/reject")
def reject_booking(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    booking = _host_reservation(db, booking_id, user, lock=True)
    transition_booking(db, booking=booking, to_status=BookingStatus.rejected, actor=user, reason="host_reject")
    db.commit()
    return {"ok": True}
