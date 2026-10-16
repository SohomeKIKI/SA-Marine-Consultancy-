from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_active_user, require_admin
from app.iam.models import User
from app.iam.schemas import (
    LoginRequest,
    UserResponse,
    UserCreateRequest,
    UserUpdateRequest,
    TokenResponse,
    MessageResponse,
)
from app.iam import service

router = APIRouter(prefix="/iam", tags=["IAM"])


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    # 15 minutes for access token
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    # 7 days for refresh token
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/", samesite=settings.COOKIE_SAMESITE)
    response.delete_cookie(key="refresh_token", path="/", samesite=settings.COOKIE_SAMESITE)


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    user = service.authenticate_user(
        db,
        email=login_data.email,
        password=login_data.password,
        ip_address=client_ip,
    )
    access_token, refresh_token = service.create_session(db, user)
    set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(message="Login successful", user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token_str = request.cookies.get("refresh_token")
    if not token_str:
        # Check authorization header as fallback
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]

    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing from request cookies.",
        )

    new_access_token, new_refresh_token, user = service.refresh_session(db, token_str)
    set_auth_cookies(response, new_access_token, new_refresh_token)
    return TokenResponse(message="Token refreshed successfully", user=UserResponse.model_validate(user))


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token_str = request.cookies.get("refresh_token")
    if token_str:
        service.revoke_session(db, token_str)
    clear_auth_cookies(response)
    return MessageResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(User).order_by(User.id.asc())
    users = db.execute(stmt).scalars().all()
    return users


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_new_user(
    user_in: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return service.create_user(db, user_in)


@router.patch("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user_account(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return service.update_user(db, user_id, UserUpdateRequest(is_active=False))


@router.post("/users/{user_id}/revoke-sessions", response_model=MessageResponse)
def revoke_all_sessions_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    revoked_count = service.revoke_all_user_sessions(db, user_id)
    return MessageResponse(message=f"Revoked {revoked_count} active sessions for user {user_id}")
