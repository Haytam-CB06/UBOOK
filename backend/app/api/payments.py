from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_mfa
from app.core.database import get_db
from app.models import Payment, User
from app.schemas.platform import PaymentConfirm, PaymentCreate, RefundUpdate
from app.services.payment_service import confirm_payment, create_payment, payment_payload, update_refund_status

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("")
def list_payments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Payment).filter(Payment.deleted_at.is_(None)).order_by(Payment.created_at.desc())
    if user.role.value not in {"admin", "super_admin"}:
        query = query.filter(Payment.user_id == user.id)
    return [payment_payload(payment) for payment in query.all()]


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
    payment = _get_payment(db, payment_id)
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


def _get_payment(db: Session, payment_id: int) -> Payment:
    payment = db.get(Payment, payment_id)
    if not payment or payment.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment
