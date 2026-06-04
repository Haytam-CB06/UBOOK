from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles, require_roles_mfa
from app.core.cache import cache
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Dispute, HostReview, Property, Report, Review, RiskEvent, Role, SupportTicket, TravelerReview, User
from app.schemas.platform import DisputeUpdate, ReportUpdate, RiskEventCreate, RiskEventUpdate, SupportTicketUpdate
from app.services.dashboard_service import platform_stats
from app.services.serialization import property_to_frontend

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(_user: User = Depends(require_roles(Role.hotel_admin, Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    cached = cache.get_json("dashboard:admin:stats")
    if cached is not None:
        return cached
    payload = platform_stats(db)
    cache.set_json("dashboard:admin:stats", payload, ttl_seconds=60)
    return payload


@router.get("/users")
def list_users(
    query: str | None = Query(default=None),
    role: str | None = Query(default=None),
    _user: User = Depends(require_roles(Role.admin, Role.super_admin)),
    db: Session = Depends(get_db),
):
    users_query = db.query(User).filter(User.deleted_at.is_(None))
    if query:
        search = f"%{query.lower()}%"
        users_query = users_query.filter((User.email.ilike(search)) | (User.full_name.ilike(search)))
    if role:
        role_map = {"traveler": Role.guest, "guest": Role.guest, "host": Role.hotel_admin, "admin": Role.admin}
        mapped = role_map.get(role.strip().lower())
        if mapped:
            users_query = users_query.filter(User.role == mapped)
    users = users_query.order_by(User.created_at.desc()).all()
    return [_user_payload(user) for user in users]


@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: int, _user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    user.suspended_at = now_utc()
    db.commit()
    return _user_payload(user)


@router.post("/users/{user_id}/ban")
def ban_user(user_id: int, _user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    user.banned_at = now_utc()
    user.is_active = False
    db.commit()
    return _user_payload(user)


@router.post("/users/{user_id}/restore")
def restore_user(user_id: int, _user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    user.suspended_at = None
    user.banned_at = None
    user.is_active = True
    db.commit()
    return _user_payload(user)


@router.get("/listings")
def list_listings(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    properties = db.query(Property).filter(Property.deleted_at.is_(None)).order_by(Property.created_at.desc()).all()
    return [property_to_frontend(property_) for property_ in properties]


@router.post("/listings/{property_id}/verify")
def verify_listing(property_id: int, _user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    property_.verified = True
    db.commit()
    cache.delete_prefix("search:properties")
    cache.delete("dashboard:admin:stats")
    return property_to_frontend(property_)


@router.delete("/listings/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(property_id: int, _user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    property_ = db.get(Property, property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    property_.deleted_at = now_utc()
    db.commit()
    cache.delete_prefix("search:properties")
    cache.delete("dashboard:admin:stats")


@router.get("/reviews")
def list_reviews(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    return {
        "propertyReviews": [
            {"id": review.id, "propertyId": review.property_id, "rating": review.rating, "comment": review.comment, "deletedAt": review.deleted_at.isoformat() if review.deleted_at else None}
            for review in db.query(Review).order_by(Review.created_at.desc()).all()
        ],
        "hostReviews": [
            {"id": review.id, "hostId": review.host_id, "rating": review.rating, "comment": review.comment, "deletedAt": review.deleted_at.isoformat() if review.deleted_at else None}
            for review in db.query(HostReview).order_by(HostReview.created_at.desc()).all()
        ],
        "travelerReviews": [
            {"id": review.id, "travelerId": review.traveler_id, "rating": review.rating, "comment": review.comment, "deletedAt": review.deleted_at.isoformat() if review.deleted_at else None}
            for review in db.query(TravelerReview).order_by(TravelerReview.created_at.desc()).all()
        ],
    }


@router.get("/support")
def list_support_tickets(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    rows = db.query(SupportTicket).filter(SupportTicket.deleted_at.is_(None)).order_by(SupportTicket.created_at.desc()).all()
    return [_support_payload(row) for row in rows]


@router.patch("/support/{ticket_id}")
def update_support_ticket(ticket_id: int, payload: SupportTicketUpdate, user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket or ticket.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)
    db.commit()
    db.refresh(ticket)
    return _support_payload(ticket)


@router.get("/disputes")
def list_disputes(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    rows = db.query(Dispute).filter(Dispute.deleted_at.is_(None)).order_by(Dispute.created_at.desc()).all()
    return [_dispute_payload(row) for row in rows]


@router.patch("/disputes/{dispute_id}")
def update_dispute(dispute_id: int, payload: DisputeUpdate, user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    dispute = db.get(Dispute, dispute_id)
    if not dispute or dispute.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(dispute, key, value)
    db.commit()
    db.refresh(dispute)
    return _dispute_payload(dispute)


@router.get("/reports")
def list_reports(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    rows = db.query(Report).filter(Report.deleted_at.is_(None)).order_by(Report.created_at.desc()).all()
    return [_report_payload(row) for row in rows]


@router.patch("/reports/{report_id}")
def update_report(report_id: int, payload: ReportUpdate, user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report or report.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(report, key, value)
    db.commit()
    db.refresh(report)
    return _report_payload(report)


@router.get("/risk-events")
def list_risk_events(_user: User = Depends(require_roles(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    rows = db.query(RiskEvent).filter(RiskEvent.deleted_at.is_(None)).order_by(RiskEvent.created_at.desc()).all()
    return [_risk_payload(row) for row in rows]


@router.post("/risk-events", status_code=status.HTTP_201_CREATED)
def create_risk_event(payload: RiskEventCreate, user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    row = RiskEvent(entity_type=payload.entity_type, entity_id=payload.entity_id, signal_type=payload.signal_type, severity=payload.severity, metadata_json=payload.metadata_json)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _risk_payload(row)


@router.patch("/risk-events/{risk_event_id}")
def update_risk_event(risk_event_id: int, payload: RiskEventUpdate, user: User = Depends(require_roles_mfa(Role.admin, Role.super_admin)), db: Session = Depends(get_db)):
    row = db.get(RiskEvent, risk_event_id)
    if not row or row.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk event not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    if payload.status in {"resolved", "closed"}:
        row.resolved_by_id = user.id
        row.resolved_at = now_utc()
    db.commit()
    db.refresh(row)
    return _risk_payload(row)


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or user.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "role": "Host" if user.role == Role.hotel_admin else "Traveler" if user.role == Role.guest else "Admin",
        "isActive": user.is_active,
        "suspendedAt": user.suspended_at.isoformat() if user.suspended_at else None,
        "bannedAt": user.banned_at.isoformat() if user.banned_at else None,
        "createdAt": user.created_at.isoformat(),
    }


def _support_payload(ticket: SupportTicket) -> dict:
    return {
        "id": ticket.id,
        "userId": ticket.user_id,
        "assignedAdminId": ticket.assigned_admin_id,
        "subject": ticket.subject,
        "body": ticket.body,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "resolution": ticket.resolution,
        "createdAt": ticket.created_at.isoformat(),
        "updatedAt": ticket.updated_at.isoformat(),
    }


def _dispute_payload(dispute: Dispute) -> dict:
    return {
        "id": dispute.id,
        "bookingId": dispute.booking_id,
        "openedById": dispute.opened_by_id,
        "assignedAdminId": dispute.assigned_admin_id,
        "reason": dispute.reason,
        "status": dispute.status,
        "resolution": dispute.resolution,
        "createdAt": dispute.created_at.isoformat(),
        "updatedAt": dispute.updated_at.isoformat(),
    }


def _report_payload(report: Report) -> dict:
    return {
        "id": report.id,
        "reporterId": report.reporter_id,
        "targetType": report.target_type,
        "targetId": report.target_id,
        "reason": report.reason,
        "status": report.status,
        "resolution": report.resolution,
        "createdAt": report.created_at.isoformat(),
        "updatedAt": report.updated_at.isoformat(),
    }


def _risk_payload(row: RiskEvent) -> dict:
    return {
        "id": row.id,
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "signalType": row.signal_type,
        "severity": row.severity,
        "status": row.status,
        "metadataJson": row.metadata_json,
        "resolvedById": row.resolved_by_id,
        "resolvedAt": row.resolved_at.isoformat() if row.resolved_at else None,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }
