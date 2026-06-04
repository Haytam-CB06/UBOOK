from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Booking, Dispute, Report, Role, SupportTicket, User
from app.schemas.platform import DisputeCreate, ReportCreate, SupportTicketCreate
from app.services.audit_service import audit
from app.services.notification_service import create_notification

router = APIRouter(tags=["operations"])


@router.get("/support/me")
def my_support_tickets(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SupportTicket).filter(SupportTicket.user_id == user.id, SupportTicket.deleted_at.is_(None)).order_by(SupportTicket.created_at.desc()).all()
    return [_support_payload(row) for row in rows]


@router.post("/support", status_code=status.HTTP_201_CREATED)
def create_support_ticket(payload: SupportTicketCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = SupportTicket(user_id=user.id, subject=payload.subject, body=payload.body, category=payload.category, priority=payload.priority)
    db.add(ticket)
    create_notification(db, notification_type="support_ticket_created", subject="Support ticket created", body=f"Ticket opened: {payload.subject}", user=user)
    audit(db, action="support.created", actor=user, entity_type="support_ticket", entity_id="pending")
    db.commit()
    db.refresh(ticket)
    return _support_payload(ticket)


@router.get("/disputes/me")
def my_disputes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Dispute).filter(Dispute.opened_by_id == user.id, Dispute.deleted_at.is_(None)).order_by(Dispute.created_at.desc()).all()
    return [_dispute_payload(row) for row in rows]


@router.post("/disputes", status_code=status.HTTP_201_CREATED)
def create_dispute(payload: DisputeCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, payload.booking_id)
    if not booking or booking.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    owns_booking = booking.user_id == user.id or booking.email.lower() == user.email.lower()
    owns_property = booking.property.owner_id == user.id
    if not owns_booking and not owns_property and user.role not in {Role.admin, Role.super_admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot dispute this booking")
    dispute = Dispute(booking_id=booking.id, opened_by_id=user.id, reason=payload.reason)
    db.add(dispute)
    create_notification(db, notification_type="dispute_created", subject=f"Dispute opened for {booking.booking_reference}", body=payload.reason, user=user)
    audit(db, action="dispute.created", actor=user, entity_type="booking", entity_id=booking.id)
    db.commit()
    db.refresh(dispute)
    return _dispute_payload(dispute)


@router.get("/reports/me")
def my_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Report).filter(Report.reporter_id == user.id, Report.deleted_at.is_(None)).order_by(Report.created_at.desc()).all()
    return [_report_payload(row) for row in rows]


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = Report(reporter_id=user.id, target_type=payload.target_type, target_id=payload.target_id, reason=payload.reason)
    db.add(report)
    create_notification(db, notification_type="report_created", subject="Report submitted", body=f"Your report for {payload.target_type} #{payload.target_id} was submitted.", user=user)
    audit(db, action="report.created", actor=user, entity_type=payload.target_type, entity_id=payload.target_id)
    db.commit()
    db.refresh(report)
    return _report_payload(report)


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
