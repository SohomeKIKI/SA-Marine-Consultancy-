from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.payments.models import Payment, PaymentMode
from app.payments.schemas import PaymentCreate, PaymentUpdate, StudentTotalsResponse
from app.students.models import Student
from app.iam.models import User, UserRole
from app.audit import service as audit_service


def create_payment(db: Session, payment_in: PaymentCreate, user: User) -> Payment:
    student = db.get(Student, payment_in.student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {payment_in.student_id} not found."
        )

    payment = Payment(
        student_id=payment_in.student_id,
        amount=payment_in.amount,
        payment_date=payment_in.payment_date or func.now(),
        mode=payment_in.mode,
        online_account=payment_in.online_account.strip() if payment_in.online_account else None,
        recorded_by=user.id,
    )
    db.add(payment)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="create",
        entity_type="payment",
        entity_id=payment.id,
    )
    db.commit()
    db.refresh(payment)
    return payment


def get_payment_by_id(db: Session, payment_id: int) -> Payment:
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with ID {payment_id} not found."
        )
    return payment


def list_student_payments(db: Session, student_id: int) -> List[Payment]:
    stmt = select(Payment).where(Payment.student_id == student_id).order_by(Payment.payment_date.desc(), Payment.id.desc())
    return list(db.execute(stmt).scalars().all())


def get_student_totals(db: Session, student_id: int) -> StudentTotalsResponse:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} not found."
        )

    stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.student_id == student_id)
    total_paid = Decimal(str(db.execute(stmt).scalar() or "0.00"))
    total_due = Decimal(str(student.total_required)) - total_paid

    return StudentTotalsResponse(
        student_id=student.id,
        student_number=student.student_number,
        total_required=student.total_required,
        total_paid=total_paid,
        total_due=total_due,
    )


def update_payment(db: Session, payment_id: int, payment_in: PaymentUpdate, user: User) -> Payment:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action requires admin privileges."
        )

    payment = get_payment_by_id(db, payment_id)
    changes: Dict[str, Tuple[Any, Any]] = {}

    if payment_in.amount is not None and payment_in.amount != payment.amount:
        changes["amount"] = (payment.amount, payment_in.amount)
        payment.amount = payment_in.amount

    if payment_in.payment_date is not None and payment_in.payment_date != payment.payment_date:
        changes["payment_date"] = (payment.payment_date, payment_in.payment_date)
        payment.payment_date = payment_in.payment_date

    if payment_in.mode is not None and payment_in.mode != payment.mode:
        changes["mode"] = (payment.mode.value, payment_in.mode.value)
        payment.mode = payment_in.mode

    if payment_in.online_account is not None and payment_in.online_account != payment.online_account:
        changes["online_account"] = (payment.online_account, payment_in.online_account)
        payment.online_account = payment_in.online_account

    if changes:
        audit_service.record(
            db=db,
            user=user,
            action="update",
            entity_type="payment",
            entity_id=payment.id,
            changes=changes,
        )

    db.commit()
    db.refresh(payment)
    return payment


def delete_payment(db: Session, payment_id: int, user: User) -> None:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action requires admin privileges."
        )

    payment = get_payment_by_id(db, payment_id)
    pay_id = payment.id
    db.delete(payment)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="delete",
        entity_type="payment",
        entity_id=pay_id,
    )
    db.commit()
