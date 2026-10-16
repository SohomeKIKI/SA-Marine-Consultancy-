from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import CursorResult, select, func, update

from app.notifications.models import Notification
from app.iam.models import User, UserRole
from app.students.models import Student


def fanout_employee_student_edit(
    db: Session,
    employee: User,
    student: Student,
    changes: Dict[str, Tuple[Any, Any]],
) -> List[Notification]:
    """
    Creates a notification for every active admin when an employee edits a student.
    Format: 'Priya edited student STU-2026-000012: course changed from ETO to BSC'
    """
    delta_parts = []
    for field, (old_val, new_val) in changes.items():
        delta_parts.append(f"{field} changed from {old_val} to {new_val}")
    delta_str = "; ".join(delta_parts)

    actor_name = employee.display_name if (employee.display_name and employee.display_name.strip()) else employee.email
    message = f"{actor_name} edited student {student.student_number}: {delta_str}"

    stmt = select(User).where(User.role == UserRole.admin, User.is_active.is_(True))
    admins = db.execute(stmt).scalars().all()

    created_notifications: List[Notification] = []
    for admin in admins:
        notif = Notification(
            recipient_id=admin.id,
            message=message,
            entity_type="student",
            entity_id=str(student.id),
            is_read=False,
        )
        db.add(notif)
        created_notifications.append(notif)

    db.flush()
    return created_notifications


def list_user_notifications(db: Session, user_id: int, unread_only: bool = False) -> List[Notification]:
    stmt = select(Notification).where(Notification.recipient_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def get_unread_count(db: Session, user_id: int) -> int:
    stmt = select(func.count(Notification.id)).where(
        Notification.recipient_id == user_id,
        Notification.is_read.is_(False)
    )
    return db.execute(stmt).scalar() or 0


def mark_notification_as_read(db: Session, notification_id: int, user_id: int) -> Notification:
    notif = db.get(Notification, notification_id)
    if not notif or notif.recipient_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID {notification_id} not found."
        )

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


def mark_all_notifications_as_read(db: Session, user_id: int) -> int:
    stmt = (
        update(Notification)
        .where(Notification.recipient_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    res = db.execute(stmt)
    db.commit()
    if isinstance(res, CursorResult):
        return res.rowcount or 0
    return 0
