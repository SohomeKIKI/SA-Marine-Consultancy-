import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.iam.models import User, UserRole
from app.iam.service import revoke_all_user_sessions
from app.core.security import get_password_hash
from app.admin.schemas import AdminUserCreateRequest, AdminUserUpdateRequest
from app.audit import service as audit_service

logger = logging.getLogger(__name__)


def count_active_admins(db: Session) -> int:
    stmt = select(func.count(User.id)).where(
        User.role == UserRole.admin,
        User.is_active.is_(True),
    )
    return db.execute(stmt).scalar() or 0


def list_users(
    db: Session,
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[User], int]:
    query = select(User)

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(User.name).like(search_pattern)
            | func.lower(User.email).like(search_pattern)
        )

    if role is not None:
        query = query.where(User.role == role)

    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.execute(count_stmt).scalar() or 0

    offset = (page - 1) * limit
    paged_query = query.order_by(User.id.asc()).offset(offset).limit(limit)
    items = list(db.execute(paged_query).scalars().all())

    return items, total


def create_user(db: Session, user_in: AdminUserCreateRequest, current_user: User) -> User:
    email_clean = user_in.email.strip().lower()

    # Check email uniqueness
    stmt = select(User).where(func.lower(User.email) == email_clean)
    existing = db.execute(stmt).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    new_user = User(
        name=user_in.name.strip(),
        email=email_clean,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    audit_service.record(
        db=db,
        user=current_user,
        action="user.create",
        entity_type="user",
        entity_id=new_user.id,
    )

    db.commit()
    db.refresh(new_user)
    return new_user


def update_user(db: Session, user_id: int, user_in: AdminUserUpdateRequest, current_user: User) -> User:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    changes: Dict[str, Tuple[Any, Any]] = {}

    # Email uniqueness check if changing email
    if user_in.email is not None:
        new_email = user_in.email.strip().lower()
        if new_email != target_user.email.lower():
            stmt = select(User).where(func.lower(User.email) == new_email, User.id != user_id)
            existing = db.execute(stmt).scalars().first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email already exists."
                )
            changes["email"] = (target_user.email, new_email)
            target_user.email = new_email

    # Name update
    if user_in.name is not None and user_in.name.strip() != target_user.name:
        changes["name"] = (target_user.name, user_in.name.strip())
        target_user.name = user_in.name.strip()

    # Role update
    if user_in.role is not None and user_in.role != target_user.role:
        # Rule: Admin cannot demote self
        if target_user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot change or demote their own role."
            )

        # Rule: Check that system doesn't leave 0 active admins
        if target_user.role == UserRole.admin and user_in.role == UserRole.employee and target_user.is_active:
            if count_active_admins(db) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot demote the last active administrator."
                )

        changes["role"] = (target_user.role.value, user_in.role.value)
        target_user.role = user_in.role

    if changes:
        audit_service.record(
            db=db,
            user=current_user,
            action="user.update",
            entity_type="user",
            entity_id=target_user.id,
            changes=changes,
        )

    db.commit()
    db.refresh(target_user)
    return target_user


def reset_user_password(db: Session, user_id: int, new_password: str, current_user: User) -> User:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.password_hash = get_password_hash(new_password)
    # Revoke that user's existing refresh tokens
    revoke_all_user_sessions(db, target_user.id)

    audit_service.record(
        db=db,
        user=current_user,
        action="user.password_reset",
        entity_type="user",
        entity_id=target_user.id,
    )

    db.commit()
    db.refresh(target_user)
    return target_user


def deactivate_user(db: Session, user_id: int, current_user: User) -> User:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Rule: Admin cannot deactivate themselves
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot deactivate their own account."
        )

    # Rule: Check that system doesn't leave 0 active admins
    if target_user.role == UserRole.admin and target_user.is_active:
        if count_active_admins(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot deactivate the last active administrator."
            )

    if not target_user.is_active:
        return target_user

    target_user.is_active = False
    # Revoke that user's existing refresh tokens
    revoke_all_user_sessions(db, target_user.id)

    audit_service.record(
        db=db,
        user=current_user,
        action="user.deactivate",
        entity_type="user",
        entity_id=target_user.id,
        changes={"is_active": (True, False)},
    )

    db.commit()
    db.refresh(target_user)
    return target_user


def activate_user(db: Session, user_id: int, current_user: User) -> User:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target_user.is_active:
        return target_user

    target_user.is_active = True

    audit_service.record(
        db=db,
        user=current_user,
        action="user.activate",
        entity_type="user",
        entity_id=target_user.id,
        changes={"is_active": (False, True)},
    )

    db.commit()
    db.refresh(target_user)
    return target_user


def revoke_user_sessions(db: Session, user_id: int, current_user: User) -> int:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Rule: Admin cannot revoke their own account through this endpoint
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot revoke their own sessions through this endpoint."
        )

    count = revoke_all_user_sessions(db, target_user.id)

    audit_service.record(
        db=db,
        user=current_user,
        action="user.session_revoke",
        entity_type="user",
        entity_id=target_user.id,
    )

    db.commit()
    return count
