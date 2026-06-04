from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import _user_payload
from app.api.deps import get_current_user
from app.core.crypto import decrypt_text, encrypt_text
from app.core.database import get_db
from app.models import AccountPreference, HostProfile, NotificationPreference, Role, TravelerProfile, User
from app.schemas.platform import AccountPreferenceUpdate, NotificationPreferenceUpdate, ProfileUpdate

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
