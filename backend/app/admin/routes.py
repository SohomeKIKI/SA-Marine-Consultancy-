import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.iam.models import User, UserRole
from app.iam.schemas import UserResponse, MessageResponse
from app.admin import service
from app.admin.schemas import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminResetPasswordRequest,
    PaginatedUsers,
)

router = APIRouter(tags=["Admin Users"])


@router.get("/users", response_model=PaginatedUsers)
def list_admin_users(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    items, total = service.list_users(
        db=db,
        search=search,
        role=role,
        is_active=is_active,
        page=page,
        limit=limit,
    )
    pages = math.ceil(total / limit) if total > 0 else 1
    return PaginatedUsers(
        items=[UserResponse.model_validate(u) for u in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    user_in: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = service.create_user(db, user_in, current_user)
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_admin_user(
    user_id: int,
    user_in: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = service.update_user(db, user_id, user_in, current_user)
    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/reset-password", response_model=MessageResponse)
def reset_admin_user_password(
    user_id: int,
    reset_in: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service.reset_user_password(db, user_id, reset_in.password, current_user)
    return MessageResponse(message="Password reset successfully.")


@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = service.deactivate_user(db, user_id, current_user)
    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/activate", response_model=UserResponse)
def activate_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = service.activate_user(db, user_id, current_user)
    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/revoke-sessions", response_model=MessageResponse)
def revoke_admin_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    count = service.revoke_user_sessions(db, user_id, current_user)
    return MessageResponse(message=f"Revoked {count} sessions for user {user_id}")
