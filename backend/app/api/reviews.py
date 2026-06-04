from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Booking, BookingStatus, HostReview, Property, Review, ReviewImage, Role, TravelerReview, User
from app.schemas.platform import HostReviewCreate, PropertyReviewCreate, TravelerReviewCreate
from app.schemas.property import ReviewCreate
from app.services.notification_service import create_notification
from app.services.serialization import review_to_frontend

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _recalculate_rating(db: Session, property_id: int) -> None:
    avg_rating, count = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.property_id == property_id, Review.deleted_at.is_(None))
        .one()
    )
    property_ = db.get(Property, property_id)
    if property_:
        property_.rating = round(float(avg_rating or 0), 2)
        property_.average_rating = round(float(avg_rating or 0), 2)
        property_.review_count = int(count or 0)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_review(payload: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return create_property_review(PropertyReviewCreate(**payload.model_dump()), user, db)


@router.post("/property", status_code=status.HTTP_201_CREATED)
def create_property_review(payload: PropertyReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, payload.booking_id)
    if not booking or booking.property_id != payload.property_id or booking.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only verified booking guests can review this stay")
    if booking.status not in {BookingStatus.checked_out, BookingStatus.completed}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking must be checked out before review")
    existing = db.query(Review).filter(Review.booking_id == payload.booking_id, Review.user_id == user.id, Review.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking already has a property review")
    review = Review(
        property_id=payload.property_id,
        booking_id=payload.booking_id,
        user_id=user.id,
        author_name=user.full_name,
        role_label="Verified booking guest",
        avatar_url=user.avatar_url or "",
        rating=payload.rating,
        comment=payload.comment,
        verified_booking=True,
    )
    db.add(review)
    db.flush()
    for index, url in enumerate(payload.image_urls):
        db.add(ReviewImage(review_id=review.id, url=url, sort_order=index))
    _recalculate_rating(db, payload.property_id)
    if booking.property.owner:
        create_notification(
            db,
            notification_type="review_received",
            subject=f"New review for {booking.property.title or booking.property.name}",
            body=payload.comment,
            user=booking.property.owner,
        )
    db.commit()
    db.refresh(review)
    return review_to_frontend(review)


@router.post("/host", status_code=status.HTTP_201_CREATED)
def create_host_review(payload: HostReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, payload.booking_id)
    if not booking or booking.user_id != user.id or booking.property.owner_id != payload.host_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the booking traveler can review the host")
    if booking.status not in {BookingStatus.completed, BookingStatus.checked_out}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking must be completed before host review")
    existing = db.query(HostReview).filter(HostReview.booking_id == booking.id, HostReview.reviewer_id == user.id, HostReview.host_id == payload.host_id, HostReview.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking already has a host review")
    review = HostReview(booking_id=booking.id, reviewer_id=user.id, host_id=payload.host_id, rating=payload.rating, comment=payload.comment)
    db.add(review)
    db.flush()
    _recalculate_host_rating(db, payload.host_id)
    host = db.get(User, payload.host_id)
    if host:
        create_notification(db, notification_type="review_received", subject="New host review received", body=payload.comment, user=host)
    db.commit()
    return _host_review_payload(review)


@router.post("/traveler", status_code=status.HTTP_201_CREATED)
def create_traveler_review(payload: TravelerReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in {Role.hotel_admin, Role.admin, Role.super_admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only hosts can review travelers")
    booking = db.get(Booking, payload.booking_id)
    if not booking or booking.user_id != payload.traveler_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found for traveler")
    if user.role == Role.hotel_admin and booking.property.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot review a traveler from another host's booking")
    if booking.status not in {BookingStatus.completed, BookingStatus.checked_out}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking must be completed before traveler review")
    existing = db.query(TravelerReview).filter(TravelerReview.booking_id == booking.id, TravelerReview.reviewer_id == user.id, TravelerReview.traveler_id == payload.traveler_id, TravelerReview.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking already has a traveler review")
    review = TravelerReview(booking_id=booking.id, reviewer_id=user.id, traveler_id=payload.traveler_id, rating=payload.rating, comment=payload.comment)
    db.add(review)
    db.flush()
    _recalculate_traveler_rating(db, payload.traveler_id)
    traveler = db.get(User, payload.traveler_id)
    if traveler:
        create_notification(db, notification_type="review_received", subject="New traveler review received", body=payload.comment, user=traveler)
    db.commit()
    return _traveler_review_payload(review)


@router.put("/{review_id}")
def update_review(review_id: int, payload: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review or review.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's review")
    review.rating = payload.rating
    review.comment = payload.comment
    _recalculate_rating(db, review.property_id)
    db.commit()


def _recalculate_host_rating(db: Session, host_id: int) -> None:
    avg_rating, count = (
        db.query(func.avg(HostReview.rating), func.count(HostReview.id))
        .filter(HostReview.host_id == host_id, HostReview.deleted_at.is_(None))
        .one()
    )
    host = db.get(User, host_id)
    if host and host.host_profile:
        host.host_profile.average_rating = round(float(avg_rating or 0), 2)
        host.host_profile.review_count = int(count or 0)


def _recalculate_traveler_rating(db: Session, traveler_id: int) -> None:
    avg_rating, count = (
        db.query(func.avg(TravelerReview.rating), func.count(TravelerReview.id))
        .filter(TravelerReview.traveler_id == traveler_id, TravelerReview.deleted_at.is_(None))
        .one()
    )
    traveler = db.get(User, traveler_id)
    if traveler and traveler.traveler_profile:
        traveler.traveler_profile.average_rating_received = round(float(avg_rating or 0), 2)
        traveler.traveler_profile.review_count_received = int(count or 0)


def _host_review_payload(review: HostReview) -> dict:
    return {
        "id": review.id,
        "bookingId": review.booking_id,
        "hostId": review.host_id,
        "reviewerId": review.reviewer_id,
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.created_at.isoformat(),
    }


def _traveler_review_payload(review: TravelerReview) -> dict:
    return {
        "id": review.id,
        "bookingId": review.booking_id,
        "travelerId": review.traveler_id,
        "reviewerId": review.reviewer_id,
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.created_at.isoformat(),
    }
    return review_to_frontend(review)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(review_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review or review.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's review")
    review.deleted_at = now_utc()
    _recalculate_rating(db, review.property_id)
    db.commit()
