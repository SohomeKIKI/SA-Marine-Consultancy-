from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_active_user
from app.core.security import verify_password, get_password_hash
from app.iam.models import User
from app.iam.schemas import (
    UserResponse,
    ProfileUpdateRequest,
    ChangePasswordRequest,
    MessageResponse,
)
from app.iam import service
from app.audit import service as audit_service

router = APIRouter(tags=["Profile"])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns the current logged-in user's profile.
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(
    profile_in: ProfileUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Updates display_name only. Extra fields (e.g. role, email) are forbidden.
    Writes an audit entry with old and new values.
    """
    old_display_name = current_user.display_name
    new_display_name = (
        profile_in.display_name.strip()
        if profile_in.display_name is not None and profile_in.display_name.strip()
        else None
    )

    if old_display_name != new_display_name:
        current_user.display_name = new_display_name
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        audit_service.record(
            db,
            user=current_user,
            action="user.update",
            entity_type="user",
            entity_id=str(current_user.id),
            changes={"display_name": (old_display_name, new_display_name)},
            ip_address=client_ip,
            user_agent=user_agent,
        )
        db.commit()
        db.refresh(current_user)

    return current_user


@router.post("/me/change-password", response_model=MessageResponse)
def change_password(
    pass_data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Requires the current password, validates new password (minimum 8 characters),
    and revokes all other refresh tokens for the user after the change.
    """
    if not verify_password(pass_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if len(pass_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    current_user.password_hash = get_password_hash(pass_data.new_password)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    audit_service.record(
        db,
        user=current_user,
        action="user.password_change",
        entity_type="user",
        entity_id=str(current_user.id),
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Revoke all other refresh tokens for this user
    refresh_token_cookie = request.cookies.get("refresh_token")
    service.revoke_other_user_sessions(db, current_user.id, refresh_token_cookie)

    db.commit()
    return MessageResponse(message="Password changed successfully")
