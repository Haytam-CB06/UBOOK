from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import _user_payload
from app.api.deps import get_current_user
from app.core.crypto import decrypt_text, encrypt_text
from app.core.database import get_db
from app.models import AccountPreference, HostProfile, HostReview, NotificationPreference, Property, Review, Role, TravelerProfile, User
from app.schemas.platform import AccountPreferenceUpdate, NotificationPreferenceUpdate, ProfileUpdate
from app.services.serialization import property_to_frontend, review_to_frontend

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me")
def get_profile(user: User = Depends(get_current_user)):
    profile = user.host_profile if user.role == Role.hotel_admin else user.traveler_profile
    return {
        "user": _user_payload(user),
        "profile": _profile_payload(profile),
    }


@router.put("/me")
def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.full_name:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = encrypt_text(payload.phone)
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if user.role == Role.hotel_admin:
        profile = user.host_profile or HostProfile(user_id=user.id)
        if not user.host_profile:
            db.add(profile)
        if payload.phone is not None:
            profile.phone = encrypt_text(payload.phone)
        if payload.bio is not None:
            profile.bio = payload.bio
    else:
        profile = user.traveler_profile or TravelerProfile(user_id=user.id)
        if not user.traveler_profile:
            db.add(profile)
        if payload.phone is not None:
            profile.phone = encrypt_text(payload.phone)
        if payload.bio is not None:
            profile.bio = payload.bio
    db.commit()
    db.refresh(user)
    return {"user": _user_payload(user), "profile": _profile_payload(profile)}


@router.get("/hosts/{host_id}")
def get_public_host_profile(host_id: int, db: Session = Depends(get_db)):
    host = db.get(User, host_id)
    if not host or host.deleted_at or host.role != Role.hotel_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Host not found")

    properties = (
        db.query(Property)
        .filter(Property.owner_id == host.id, Property.deleted_at.is_(None), Property.is_active.is_(True))
        .order_by(Property.average_rating.desc(), Property.review_count.desc(), Property.created_at.desc())
        .all()
    )
    property_ids = [property_.id for property_ in properties]
    host_reviews = (
        db.query(HostReview)
        .filter(HostReview.host_id == host.id, HostReview.deleted_at.is_(None))
        .order_by(HostReview.created_at.desc())
        .all()
    )
    property_reviews = (
        db.query(Review)
        .filter(Review.property_id.in_(property_ids), Review.deleted_at.is_(None))
        .order_by(Review.created_at.desc())
        .all()
        if property_ids
        else []
    )

    host_review_payloads = [_host_review_payload(review) for review in host_reviews]
    property_review_payloads = [_property_review_payload(review) for review in property_reviews]
    all_reviews = sorted(
        [
            *[{**review, "reviewType": "host", "propertyTitle": "Host review"} for review in host_review_payloads],
            *[{**review, "reviewType": "apartment"} for review in property_review_payloads],
        ],
        key=lambda review: review.get("createdAt", ""),
        reverse=True,
    )

    return {
        "host": {
            "id": host.id,
            "name": host.full_name,
            "email": host.email,
            "avatarUrl": host.avatar_url,
            "createdAt": host.created_at.isoformat(),
        },
        "profile": _profile_payload(host.host_profile),
        "properties": [property_to_frontend(property_) for property_ in properties],
        "hostReviews": host_review_payloads,
        "propertyReviews": property_review_payloads,
        "allReviews": all_reviews,
        "stats": {
            "listingCount": len(properties),
            "hostReviewCount": len(host_reviews),
            "propertyReviewCount": len(property_reviews),
            "averagePropertyRating": round(sum(float(property_.average_rating or property_.rating or 0) for property_ in properties) / len(properties), 2) if properties else 0,
        },
    }


@router.post("/me/verify-email")
def verify_email(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.email_verified = True
    db.commit()
    return {"ok": True}


@router.post("/me/verify-phone")
def verify_phone(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.phone_verified = True
    db.commit()
    return {"ok": True}


@router.get("/me/preferences")
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_preferences = _notification_preferences(user, db)
    account_preferences = _account_preferences(user, db)
    db.commit()
    return {
        "notifications": _notification_preferences_payload(notification_preferences),
        "account": _account_preferences_payload(account_preferences),
    }


@router.put("/me/preferences/notifications")
def update_notification_preferences(payload: NotificationPreferenceUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    preferences = _notification_preferences(user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(preferences, key, value)
    db.commit()
    db.refresh(preferences)
    return _notification_preferences_payload(preferences)


@router.put("/me/preferences/account")
def update_account_preferences(payload: AccountPreferenceUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    preferences = _account_preferences(user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(preferences, key, value)
    db.commit()
    db.refresh(preferences)
    return _account_preferences_payload(preferences)


def _profile_payload(profile) -> dict:
    if profile is None:
        return {}
    return {
        "id": profile.id,
        "phone": decrypt_text(profile.phone),
        "bio": profile.bio,
        "averageRating": getattr(profile, "average_rating", getattr(profile, "average_rating_received", 0)),
        "reviewCount": getattr(profile, "review_count", getattr(profile, "review_count_received", 0)),
        "verifiedBadge": getattr(profile, "verified_badge", False),
        "responseRate": getattr(profile, "response_rate", 0),
        "responseTimeMinutes": getattr(profile, "response_time_minutes", None),
        "onboardingCompletedAt": getattr(profile, "onboarding_completed_at", None).isoformat() if getattr(profile, "onboarding_completed_at", None) else None,
        "onboardingExitedAt": getattr(profile, "onboarding_exited_at", None).isoformat() if getattr(profile, "onboarding_exited_at", None) else None,
        "createdAt": profile.created_at.isoformat(),
    }


def _host_review_payload(review: HostReview) -> dict:
    reviewer = review.reviewer
    return {
        "id": review.id,
        "bookingId": review.booking_id,
        "hostId": review.host_id,
        "reviewerId": review.reviewer_id,
        "author": reviewer.full_name if reviewer else "Verified guest",
        "avatar": reviewer.avatar_url if reviewer else "",
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.created_at.isoformat(),
    }


def _property_review_payload(review: Review) -> dict:
    property_title = ""
    if review.property:
        property_title = review.property.title or review.property.name
    payload = review_to_frontend(review)
    payload["propertyId"] = review.property_id
    payload["propertyTitle"] = property_title
    payload["createdAt"] = review.created_at.isoformat()
    return payload


def _notification_preferences(user: User, db: Session) -> NotificationPreference:
    preferences = user.notification_preferences
    if not preferences:
        preferences = NotificationPreference(user_id=user.id)
        db.add(preferences)
        db.flush()
    return preferences


def _account_preferences(user: User, db: Session) -> AccountPreference:
    preferences = user.account_preferences
    if not preferences:
        preferences = AccountPreference(user_id=user.id)
        db.add(preferences)
        db.flush()
    return preferences


def _notification_preferences_payload(preferences: NotificationPreference) -> dict:
    return {
        "id": preferences.id,
        "bookingUpdates": preferences.booking_updates,
        "messages": preferences.messages,
        "reviews": preferences.reviews,
        "securityAlerts": preferences.security_alerts,
        "marketing": preferences.marketing,
        "channels": preferences.channels,
        "updatedAt": preferences.updated_at.isoformat(),
    }


def _account_preferences_payload(preferences: AccountPreference) -> dict:
    return {
        "id": preferences.id,
        "locale": preferences.locale,
        "currency": preferences.currency,
        "timezone": preferences.timezone,
        "privacy": preferences.privacy,
        "settings": preferences.settings,
        "updatedAt": preferences.updated_at.isoformat(),
    }
