from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.deleted_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    return [_payload(item) for item in notifications]


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification = db.get(Notification, notification_id)
    if not notification or notification.deleted_at or notification.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.read_at = now_utc()
    db.commit()
    return _payload(notification)


def _payload(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.notification_type,
        "subject": notification.subject,
        "body": notification.body,
        "channel": notification.channel,
        "deliveredAt": notification.delivered_at.isoformat() if notification.delivered_at else None,
        "readAt": notification.read_at.isoformat() if notification.read_at else None,
        "createdAt": notification.created_at.isoformat(),
    }
