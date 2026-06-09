from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_optional_user, require_roles
from app.core.database import get_db
from app.models import Booking, BookingStatus, Role, User
from app.schemas.booking import BookingCreate, BookingStatusUpdate
from app.services.booking_service import create_booking, transition_booking
from app.services.serialization import booking_to_frontend

router = APIRouter(prefix="/bookings", tags=["bookings"])
reservation_router = APIRouter(prefix="/reservations", tags=["reservations"])


def _booking_query(db: Session):
    return db.query(Booking).options(joinedload(Booking.property)).filter(Booking.deleted_at.is_(None))


def _locked_booking_query(db: Session):
    return db.query(Booking).filter(Booking.deleted_at.is_(None)).with_for_update(of=Booking)


def _assert_can_access_booking(booking: Booking, user: User, *, action: str) -> None:
    owns_booking = booking.user_id == user.id or booking.email.lower() == user.email.lower()
    owns_property = booking.property.owner_id == user.id
    if not owns_booking and not owns_property and user.role not in {Role.admin, Role.super_admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Cannot {action} booking")


def _cancel_booking(db: Session, booking_id: int, user: User) -> Booking:
    booking = _locked_booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    _assert_can_access_booking(booking, user, action="cancel")
    transition_booking(db, booking=booking, to_status=BookingStatus.cancelled, actor=user, reason="user_cancelled")
    return booking


@router.post("", status_code=status.HTTP_201_CREATED)
def create(payload: BookingCreate, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    booking = create_booking(db, payload=payload, user=user)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = _cancel_booking(db, booking_id, user)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@router.get("/me")
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = _booking_query(db).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [booking_to_frontend(booking) for booking in bookings]


@router.get("")
def list_bookings(user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    query = _booking_query(db)
    if user.role == Role.hotel_admin:
        query = query.join(Booking.property).filter_by(owner_id=user.id)
    return [booking_to_frontend(booking) for booking in query.order_by(Booking.created_at.desc()).all()]


@router.get("/{booking_id}")
def get_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = _booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    _assert_can_access_booking(booking, user, action="access")
    return booking_to_frontend(booking)


@router.patch("/{booking_id}/status")
def update_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)),
    db: Session = Depends(get_db),
):
    booking = _locked_booking_query(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if user.role == Role.hotel_admin and booking.property.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot manage another owner's booking")
    transition_booking(db, booking=booking, to_status=payload.status, actor=user, reason=payload.reason)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@reservation_router.post("", status_code=status.HTTP_201_CREATED)
def create_reservation(payload: BookingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = create_booking(db, payload=payload, user=user)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)


@reservation_router.get("/me")
def my_reservations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = _booking_query(db).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [booking_to_frontend(booking) for booking in bookings]


@reservation_router.patch("/{booking_id}/cancel")
def cancel_reservation(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = _cancel_booking(db, booking_id, user)
    db.commit()
    db.refresh(booking)
    return booking_to_frontend(booking)
