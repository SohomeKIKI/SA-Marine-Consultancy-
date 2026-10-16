from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.batches.models import Batch, College, BatchCollege, format_batch_name
from app.batches.schemas import BatchCreate, CollegeCreate, BatchCollegeResponse
from app.students.models import Student
from app.iam.models import User
from app.audit import service as audit_service


def list_batches(db: Session) -> List[Batch]:
    stmt = select(Batch).order_by(Batch.year.desc(), Batch.month.desc())
    return list(db.execute(stmt).scalars().all())


def get_batch_by_id(db: Session, batch_id: int) -> Batch:
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch with ID {batch_id} not found."
        )
    return batch


def create_batch(db: Session, batch_in: BatchCreate, user: User) -> Batch:
    stmt = select(Batch).where(Batch.month == batch_in.month, Batch.year == batch_in.year)
    existing = db.execute(stmt).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch for {format_batch_name(batch_in.month, batch_in.year)} already exists."
        )

    name = format_batch_name(batch_in.month, batch_in.year)
    batch = Batch(
        name=name,
        month=batch_in.month,
        year=batch_in.year,
        created_by=user.id,
    )
    db.add(batch)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="create",
        entity_type="batch",
        entity_id=batch.id,
    )
    db.commit()
    db.refresh(batch)
    return batch


def list_colleges(db: Session, active_only: bool = False) -> List[College]:
    stmt = select(College)
    if active_only:
        stmt = stmt.where(College.is_active.is_(True))
    stmt = stmt.order_by(College.name.asc())
    return list(db.execute(stmt).scalars().all())


def get_college_by_id(db: Session, college_id: int) -> College:
    college = db.get(College, college_id)
    if not college:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"College with ID {college_id} not found."
        )
    return college


def create_college(db: Session, college_in: CollegeCreate, user: User) -> College:
    name_clean = college_in.name.strip()
    stmt = select(College).where(func.lower(College.name) == name_clean.lower())
    existing = db.execute(stmt).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"College with name '{name_clean}' already exists."
        )

    college = College(
        name=name_clean,
        is_active=True,
        created_by=user.id,
    )
    db.add(college)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="create",
        entity_type="college",
        entity_id=college.id,
    )
    db.commit()
    db.refresh(college)
    return college


def deactivate_college(db: Session, college_id: int, user: User) -> College:
    college = get_college_by_id(db, college_id)
    if not college.is_active:
        return college

    old_state = college.is_active
    college.is_active = False

    audit_service.record(
        db=db,
        user=user,
        action="update",
        entity_type="college",
        entity_id=college.id,
        changes={"is_active": (old_state, False)},
    )
    db.commit()
    db.refresh(college)
    return college


def get_batch_colleges(db: Session, batch_id: int) -> List[BatchCollegeResponse]:
    batch = get_batch_by_id(db, batch_id)
    stmt = select(BatchCollege).where(BatchCollege.batch_id == batch.id).order_by(BatchCollege.id.asc())
    links = db.execute(stmt).scalars().all()

    result = []
    for link in links:
        college = db.get(College, link.college_id)
        # Count students in this batch college
        cnt_stmt = select(func.count(Student.id)).where(Student.batch_college_id == link.id)
        student_count = db.execute(cnt_stmt).scalar() or 0

        result.append(
            BatchCollegeResponse(
                id=link.id,
                batch_id=link.batch_id,
                college_id=link.college_id,
                college_name=college.name if college else "Unknown",
                college_is_active=college.is_active if college else False,
                added_by=link.added_by,
                added_at=link.added_at,
                student_count=student_count,
            )
        )
    return result


def link_college_to_batch(db: Session, batch_id: int, college_id: int, user: User) -> BatchCollege:
    batch = get_batch_by_id(db, batch_id)
    college = get_college_by_id(db, college_id)

    if not college.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot link a deactivated college to a batch.",
        )

    stmt = select(BatchCollege).where(
        BatchCollege.batch_id == batch.id,
        BatchCollege.college_id == college.id
    )
    existing = db.execute(stmt).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"College '{college.name}' is already linked to batch '{batch.name}'."
        )

    link = BatchCollege(
        batch_id=batch.id,
        college_id=college.id,
        added_by=user.id,
    )
    db.add(link)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="link",
        entity_type="batch_college",
        entity_id=link.id,
    )
    db.commit()
    db.refresh(link)
    return link


def unlink_college_from_batch(db: Session, batch_id: int, college_id: int, user: User) -> None:
    stmt = select(BatchCollege).where(
        BatchCollege.batch_id == batch_id,
        BatchCollege.college_id == college_id
    )
    link = db.execute(stmt).scalars().first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link between batch {batch_id} and college {college_id} not found."
        )

    # Check student conflict
    cnt_stmt = select(func.count(Student.id)).where(Student.batch_college_id == link.id)
    student_count = db.execute(cnt_stmt).scalar() or 0

    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot unlink college from batch: {student_count} student(s) currently enrolled in this college batch."
        )

    link_id = link.id
    db.delete(link)
    db.flush()

    audit_service.record(
        db=db,
        user=user,
        action="unlink",
        entity_type="batch_college",
        entity_id=link_id,
    )
    db.commit()
