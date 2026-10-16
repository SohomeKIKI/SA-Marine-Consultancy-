import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin, require_employee_or_admin
from app.iam.models import User
from app.audit.deps import audit_view
from app.students import service
from app.students.schemas import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    PaginatedStudents,
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=PaginatedStudents)
def list_students(
    batch_id: Optional[int] = None,
    college_id: Optional[int] = None,
    batch_college_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    students, total = service.list_students(
        db=db,
        batch_id=batch_id,
        college_id=college_id,
        batch_college_id=batch_college_id,
        search=search,
        page=page,
        limit=limit,
    )
    items = [service.build_student_response(db, s) for s in students]
    pages = math.ceil(total / limit) if total > 0 else 1
    return PaginatedStudents(items=items, total=total, page=page, limit=limit, pages=pages)


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_admin),
):
    student = service.create_student(db, student_in, current_user)
    return service.build_student_response(db, student)


@router.get(
    "/{student_id}",
    response_model=StudentResponse,
    dependencies=[Depends(audit_view("student", "student_id"))],
)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    student = service.get_student_by_id(db, student_id)
    return service.build_student_response(db, student)


@router.patch("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_admin),
):
    student, _ = service.update_student(db, student_id, student_in, current_user)
    return service.build_student_response(db, student)


@router.delete("/{student_id}", status_code=status.HTTP_200_OK)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service.delete_student(db, student_id, current_user)
    return {"message": f"Student with ID {student_id} successfully deleted."}
