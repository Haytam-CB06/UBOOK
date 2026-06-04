from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import now_utc
from app.models import HostProfile, Property, Role, User
from app.services.dashboard_service import host_dashboard
from app.services.serialization import property_to_frontend

router = APIRouter(prefix="/host", tags=["host"])


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


@router.post("/bookings/{booking_id}/accept")
def accept_booking(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    from app.models import Booking, BookingStatus
    from app.services.booking_service import transition_booking

    booking = db.get(Booking, booking_id)
    if not booking or booking.deleted_at:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == Role.hotel_admin and booking.property.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot manage another host's booking")
    transition_booking(db, booking=booking, to_status=BookingStatus.confirmed, actor=user, reason="host_accept")
    db.commit()
    return {"ok": True}


@router.post("/bookings/{booking_id}/reject")
def reject_booking(booking_id: int, user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    from app.models import Booking, BookingStatus
    from app.services.booking_service import transition_booking

    booking = db.get(Booking, booking_id)
    if not booking or booking.deleted_at:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == Role.hotel_admin and booking.property.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot manage another host's booking")
    transition_booking(db, booking=booking, to_status=BookingStatus.rejected, actor=user, reason="host_reject")
    db.commit()
    return {"ok": True}
