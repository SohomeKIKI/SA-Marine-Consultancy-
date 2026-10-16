from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.audit.models import AuditLog
from app.iam.models import User


def utcnow():
    return datetime.now(timezone.utc)


def record(
    db: Session,
    user: Optional[Union[User, int]],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[Union[str, int]] = None,
    changes: Optional[Dict[str, Tuple[Any, Any]]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> List[AuditLog]:
    """
    Appends audit log records to the current database transaction.
    If changes are provided, compares old and new values and creates one row per changed field.
    If no fields changed, logs nothing.
    Does not commit on its own; participates in the caller's transaction.
    """
    user_id = user.id if isinstance(user, User) else user
    actor_name = None
    if isinstance(user, User):
        actor_name = user.display_name if (user.display_name and user.display_name.strip()) else user.email
    ent_id_str = str(entity_id) if entity_id is not None else None
    logs_created: List[AuditLog] = []

    if changes is not None:
        for field, (old_val, new_val) in changes.items():
            # Format values to strings for comparison
            old_str = None if old_val is None else str(old_val)
            new_str = None if new_val is None else str(new_val)

            if old_str != new_str:
                log_entry = AuditLog(
                    timestamp=utcnow(),
                    user_id=user_id,
                    actor_name=actor_name,
                    action=action,
                    entity_type=entity_type,
                    entity_id=ent_id_str,
                    field=field,
                    old_value=old_str,
                    new_value=new_str,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                db.add(log_entry)
                logs_created.append(log_entry)
    else:
        log_entry = AuditLog(
            timestamp=utcnow(),
            user_id=user_id,
            actor_name=actor_name,
            action=action,
            entity_type=entity_type,
            entity_id=ent_id_str,
            field=None,
            old_value=None,
            new_value=None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log_entry)
        logs_created.append(log_entry)

    # Flush so that any table constraints or trigger failures trigger immediately
    db.flush()
    return logs_created


def get_audit_logs(
    db: Session,
    user_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[AuditLog], int]:
    """
    Returns filtered, paginated audit logs. Read-only operation.
    """
    query = select(AuditLog)

    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if action:
        query = query.where(AuditLog.action == action)
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)

    # Count total matching
    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.execute(count_stmt).scalar() or 0

    # Paginate and order by newest first
    offset = (page - 1) * limit
    paged_query = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    items = list(db.execute(paged_query).scalars().all())

    return items, total
