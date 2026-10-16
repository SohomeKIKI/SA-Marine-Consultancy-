from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text

from app.students.models import Student
from app.students.schemas import StudentCreate, StudentUpdate, StudentResponse
from app.batches.models import BatchCollege, Batch, College
from app.payments.models import Payment
from app.iam.models import User, UserRole
from app.audit import service as audit_service


def generate_student_number(db: Session, batch_year: int) -> str:
    """Generates a sequential student number in format STU-YYYY-XXXXXX."""
    seq_val = None
    try:
        # PostgreSQL sequence attempt
        seq_res = db.execute(text("SELECT nextval('student_number_seq')"))
        seq_val = seq_res.scalar()
    except Exception:
        pass

    if seq_val is None:
        # Fallback for SQLite or local testing
        cnt_stmt = select(func.count(Student.id))
        count = db.execute(cnt_stmt).scalar() or 0
        seq_val = count + 1

    return f"STU-{batch_year}-{int(seq_val):06d}"


def get_student_financials(db: Session, student_id: int, total_required: Decimal) -> Tuple[Decimal, Decimal]:
    """Calculates total_paid and total_due."""
    stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.student_id == student_id)
    total_paid = Decimal(str(db.execute(stmt).scalar() or "0.00"))
    total_due = Decimal(str(total_required)) - total_paid
    return total_paid, total_due


def build_student_response(db: Session, student: Student) -> StudentResponse:
    total_paid, total_due = get_student_financials(db, student.id, student.total_required)

    batch_college = db.get(BatchCollege, student.batch_college_id)
    batch_name = None
    batch_id = None
    college_name = None
    college_id = None

    if batch_college:
        batch_id = batch_college.batch_id
        college_id = batch_college.college_id
        batch = db.get(Batch, batch_college.batch_id)
        college = db.get(College, batch_college.college_id)
        if batch:
            batch_name = batch.name
        if college:
            college_name = college.name

    return StudentResponse(
        id=student.id,
        student_number=student.student_number,
        batch_college_id=student.batch_college_id,
        batch_id=batch_id,
        batch_name=batch_name,
        college_id=college_id,
        college_name=college_name,
        name=student.name,
        course=student.course,
        agent_name=student.agent_name,
        total_required=student.total_required,
        total_paid=total_paid,
        total_due=total_due,
        custom_data=student.custom_data or {},
        created_by=student.created_by,
        created_at=student.created_at,
        updated_at=student.updated_at,
    )


def create_student(db: Session, student_in: StudentCreate, user: User) -> Student:
    link = db.get(BatchCollege, student_in.batch_college_id)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BatchCollege link with ID {student_in.batch_college_id} does not exist."
        )

    batch = db.get(Batch, link.batch_id)
    batch_year = batch.year if batch else 2026
    student_number = generate_student_number(db, batch_year)

    student = Student(
        batch_college_id=student_in.batch_college_id,
        student_number=student_number,
        name=student_in.name.strip(),
        course=student_in.course,
        agent_name=student_in.agent_name.strip() if student_in.agent_name else None,
        total_required=student_in.total_required,
        custom_data=student_in.custom_data or {},
        created_by=user.id,
    )
    db.add(student)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="create",
        entity_type="student",
        entity_id=student.id,
    )
    db.commit()
    db.refresh(student)
    return student


def get_student_by_id(db: Session, student_id: int) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} not found."
        )
    return student


def update_student(db: Session, student_id: int, student_in: StudentUpdate, user: User) -> Tuple[Student, Dict[str, Tuple[Any, Any]]]:
    student = get_student_by_id(db, student_id)
    changes: Dict[str, Tuple[Any, Any]] = {}

    if student_in.batch_college_id is not None and student_in.batch_college_id != student.batch_college_id:
        link = db.get(BatchCollege, student_in.batch_college_id)
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"BatchCollege link with ID {student_in.batch_college_id} does not exist."
            )
        changes["batch_college_id"] = (student.batch_college_id, student_in.batch_college_id)
        student.batch_college_id = student_in.batch_college_id

    if student_in.name is not None and student_in.name.strip() != student.name:
        changes["name"] = (student.name, student_in.name.strip())
        student.name = student_in.name.strip()

    if student_in.course is not None and student_in.course != student.course:
        changes["course"] = (student.course.value, student_in.course.value)
        student.course = student_in.course

    if student_in.agent_name is not None and student_in.agent_name != student.agent_name:
        changes["agent_name"] = (student.agent_name, student_in.agent_name)
        student.agent_name = student_in.agent_name

    if student_in.total_required is not None and student_in.total_required != student.total_required:
        changes["total_required"] = (student.total_required, student_in.total_required)
        student.total_required = student_in.total_required

    if student_in.custom_data is not None and student_in.custom_data != student.custom_data:
        changes["custom_data"] = (student.custom_data, student_in.custom_data)
        student.custom_data = student_in.custom_data

    if changes:
        audit_service.record(
            db=db,
            user=user,
            action="update",
            entity_type="student",
            entity_id=student.id,
            changes=changes,
        )

        # Notify active admins if an employee made the edit
        if user.role == UserRole.employee:
            from app.notifications.service import fanout_employee_student_edit
            fanout_employee_student_edit(db, employee=user, student=student, changes=changes)

    db.commit()
    db.refresh(student)
    return student, changes


def delete_student(db: Session, student_id: int, user: User) -> None:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action requires admin privileges."
        )

    student = get_student_by_id(db, student_id)
    stu_id = student.id
    db.delete(student)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="delete",
        entity_type="student",
        entity_id=stu_id,
    )
    db.commit()


def list_students(
    db: Session,
    batch_id: Optional[int] = None,
    college_id: Optional[int] = None,
    batch_college_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[Student], int]:
    query = select(Student)

    if batch_college_id is not None:
        query = query.where(Student.batch_college_id == batch_college_id)
    elif batch_id is not None or college_id is not None:
        link_query = select(BatchCollege.id)
        if batch_id is not None:
            link_query = link_query.where(BatchCollege.batch_id == batch_id)
        if college_id is not None:
            link_query = link_query.where(BatchCollege.college_id == college_id)
        valid_link_ids = db.execute(link_query).scalars().all()
        query = query.where(Student.batch_college_id.in_(valid_link_ids))

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(Student.name).like(search_pattern)
            | func.lower(Student.student_number).like(search_pattern)
            | func.lower(Student.agent_name).like(search_pattern)
        )

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.execute(count_stmt).scalar() or 0

    offset = (page - 1) * limit
    items = list(db.execute(query.order_by(Student.id.desc()).offset(offset).limit(limit)).scalars().all())
    return items, total
