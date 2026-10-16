from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin, require_employee_or_admin
from app.iam.models import User
from app.audit.deps import audit_view
from app.payments import service
from app.payments.schemas import (
    PaymentCreate,
    PaymentUpdate,
    PaymentResponse,
    StudentTotalsResponse,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    payment_in: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_admin),
):
    return service.create_payment(db, payment_in, current_user)


@router.get("/students/{student_id}", response_model=List[PaymentResponse])
def get_student_payments(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.list_student_payments(db, student_id)


@router.get("/students/{student_id}/totals", response_model=StudentTotalsResponse)
def get_student_totals(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.get_student_totals(db, student_id)


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    dependencies=[Depends(audit_view("payment", "payment_id"))],
)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.get_payment_by_id(db, payment_id)


@router.patch("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payment_in: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return service.update_payment(db, payment_id, payment_in, current_user)


@router.delete("/{payment_id}", status_code=status.HTTP_200_OK)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service.delete_payment(db, payment_id, current_user)
    return {"message": f"Payment with ID {payment_id} successfully deleted."}
