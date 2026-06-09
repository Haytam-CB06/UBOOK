from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_mfa
from app.core.database import get_db
from app.models import Payment, PaymentStatus, RefundStatus, Role, User
from app.schemas.platform import PaymentConfirm, PaymentCreate, RefundUpdate
from app.services.payment_service import confirm_payment, create_payment, payment_payload, update_refund_status

router = APIRouter(prefix="/payments", tags=["payments"])


def _visible_payments(db: Session, user: User):
    query = db.query(Payment).filter(Payment.deleted_at.is_(None))
    if user.role not in {Role.admin, Role.super_admin}:
        query = query.filter(Payment.user_id == user.id)
    return query


@router.get("")
def list_payments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [payment_payload(payment) for payment in _visible_payments(db, user).order_by(Payment.created_at.desc()).all()]


@router.get("/overview")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _visible_payments(db, user)
    total_paid = query.filter(Payment.status == PaymentStatus.succeeded).with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    total_pending = query.filter(Payment.status.in_([PaymentStatus.pending, PaymentStatus.requires_action])).with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    total_refunded = query.filter(Payment.refund_status == RefundStatus.processed).with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    recent = _visible_payments(db, user).order_by(Payment.created_at.desc()).limit(5).all()
    return {
        "totalPaid": float(total_paid),
        "totalPending": float(total_pending),
        "totalRefunded": float(total_refunded),
        "currency": "USD",
        "recentPayments": [payment_payload(payment) for payment in recent],
    }


@router.get("/wallet")
def wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    paid = _visible_payments(db, user).filter(Payment.status == PaymentStatus.succeeded).with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    refunded = _visible_payments(db, user).filter(Payment.refund_status == RefundStatus.processed).with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    return {"id": f"user-{user.id}-wallet", "balance": round(float(paid) - float(refunded), 2), "currency": "USD", "status": "active"}


@router.get("/methods")
def list_payment_methods(_user: User = Depends(get_current_user)):
    return []


@router.post("/methods", status_code=status.HTTP_201_CREATED)
def create_payment_method(payload: dict, user: User = Depends(get_current_user)):
    token = str(payload.get("token") or "")
    if len(token) < 6:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provider token is required")
    fingerprint = hashlib.sha256(f"{user.id}:{token}".encode("utf-8")).hexdigest()[:12]
    return {
        "id": fingerprint,
        "type": str(payload.get("provider") or payload.get("type") or "card"),
        "brand": payload.get("brand"),
        "last4": payload.get("last4"),
        "expiryMonth": payload.get("expiryMonth"),
        "expiryYear": payload.get("expiryYear"),
        "isDefault": bool(payload.get("isDefault")),
    }


@router.delete("/methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(method_id: str, _user: User = Depends(get_current_user)):
    if not method_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment method not found")


@router.post("", status_code=status.HTTP_201_CREATED)
def create(payload: PaymentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = create_payment(db, payload=payload, user=user)
    db.commit()
    db.refresh(payment)
    return payment_payload(payment)


@router.get("/{payment_id}")
def get(payment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = _get_payment(db, payment_id)
    from app.services.payment_service import _assert_payment_access

    _assert_payment_access(payment.booking, user)
    return payment_payload(payment)


@router.post("/{payment_id}/confirm")
def confirm(payment_id: int, payload: PaymentConfirm, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = _get_payment(db, payment_id, lock=True)
    confirm_payment(db, payment=payment, payload=payload, user=user)
    db.commit()
    db.refresh(payment)
    return payment_payload(payment)


@router.patch("/{payment_id}/refund")
def refund(payment_id: int, payload: RefundUpdate, user: User = Depends(require_mfa), db: Session = Depends(get_db)):
    payment = _get_payment(db, payment_id)
    update_refund_status(db, payment=payment, refund_status=payload.refund_status, user=user)
    db.commit()
    db.refresh(payment)
    return payment_payload(payment)


@router.get("/{payment_id}/receipt")
def receipt(payment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = _get_payment(db, payment_id)
    from app.services.payment_service import _assert_payment_access

    _assert_payment_access(payment.booking, user)
    return {
        "type": "receipt",
        "payment": payment_payload(payment),
        "bookingReference": payment.booking.booking_reference,
        "propertyName": payment.booking.property.title or payment.booking.property.name,
    }


@router.get("/{payment_id}/invoice")
def invoice(payment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = _get_payment(db, payment_id)
    from app.services.payment_service import _assert_payment_access

    _assert_payment_access(payment.booking, user)
    return {
        "type": "invoice",
        "payment": payment_payload(payment),
        "bookingReference": payment.booking.booking_reference,
        "pricingBreakdown": payment.booking.pricing_breakdown,
    }


def _get_payment(db: Session, payment_id: int, lock: bool = False) -> Payment:
    query = db.query(Payment).filter(Payment.id == payment_id)
    if lock:
        query = query.with_for_update()
    payment = query.first()
    if not payment or payment.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment
