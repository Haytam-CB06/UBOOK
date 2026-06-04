from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Payment, PaymentStatus, RefundStatus, Role, User
from app.schemas.platform import PaymentConfirm, PaymentCreate
from app.services.notification_service import create_notification


def create_payment(db: Session, *, payload: PaymentCreate, user: User) -> Payment:
    booking = db.get(Booking, payload.booking_id)
    if not booking or booking.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    _assert_payment_access(booking, user)
    payment = Payment(
        booking_id=booking.id,
        user_id=user.id,
        provider=payload.provider,
        status=PaymentStatus.pending,
        amount=booking.total_amount,
        currency=booking.currency,
    )
    db.add(payment)
    db.flush()
    create_notification(
        db,
        notification_type="payment_created",
        subject=f"Payment created for {booking.booking_reference}",
        body="A payment record has been created and is awaiting provider confirmation.",
        user=user,
    )
    return payment


def confirm_payment(db: Session, *, payment: Payment, payload: PaymentConfirm, user: User) -> Payment:
    _assert_payment_access(payment.booking, user)
    if payload.status == PaymentStatus.succeeded and not payload.transaction_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="transactionId is required for succeeded payments")
    payment.status = payload.status
    payment.transaction_id = payload.transaction_id
    payment.invoice_url = payload.invoice_url
    payment.receipt_url = payload.receipt_url
    payment.provider_payload = payload.provider_payload
    create_notification(
        db,
        notification_type="payment_success" if payload.status == PaymentStatus.succeeded else "payment_update",
        subject=f"Payment {payload.status.value}",
        body=f"Payment for booking {payment.booking.booking_reference} is {payload.status.value}.",
        user=user,
    )
    if payload.status == PaymentStatus.succeeded and payment.booking.status == BookingStatus.pending:
        from app.services.booking_service import transition_booking
        from app.services.notification_service import booking_confirmation

        transition_booking(db, booking=payment.booking, to_status=BookingStatus.confirmed, actor=user, reason="payment_succeeded")
        booking_confirmation(db, email=payment.booking.email, booking_reference=payment.booking.booking_reference)
    return payment


def update_refund_status(db: Session, *, payment: Payment, refund_status: RefundStatus, user: User) -> Payment:
    _assert_payment_access(payment.booking, user)
    payment.refund_status = refund_status
    if refund_status == RefundStatus.processed:
        payment.status = PaymentStatus.refunded
        if payment.booking.status in {BookingStatus.pending, BookingStatus.confirmed, BookingStatus.checked_out, BookingStatus.completed}:
            from app.services.booking_service import transition_booking

            transition_booking(db, booking=payment.booking, to_status=BookingStatus.refunded, actor=user, reason="refund_processed")
    create_notification(
        db,
        notification_type="refund_update",
        subject=f"Refund {refund_status.value}",
        body=f"Refund status for booking {payment.booking.booking_reference} changed to {refund_status.value}.",
        user=user,
    )
    return payment


def payment_payload(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "bookingId": payment.booking_id,
        "provider": payment.provider.value,
        "status": payment.status.value,
        "amount": float(payment.amount),
        "currency": payment.currency,
        "transactionId": payment.transaction_id,
        "refundStatus": payment.refund_status.value,
        "invoiceUrl": payment.invoice_url,
        "receiptUrl": payment.receipt_url,
        "createdAt": payment.created_at.isoformat(),
        "updatedAt": payment.updated_at.isoformat(),
    }


def _assert_payment_access(booking: Booking, user: User) -> None:
    if user.role in {Role.admin, Role.super_admin}:
        return
    if booking.user_id == user.id or booking.email.lower() == user.email.lower():
        return
    if user.role == Role.hotel_admin and booking.property.owner_id == user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient payment permissions")
