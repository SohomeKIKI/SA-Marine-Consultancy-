import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    hash_token,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.iam.models import User, RefreshToken, FailedLoginAttempt, UserRole
from app.iam.schemas import UserCreateRequest, UserUpdateRequest


def utcnow():
    return datetime.now(timezone.utc)


def check_login_throttling(db: Session, email: str) -> None:
    cutoff = utcnow() - timedelta(minutes=15)
    stmt = select(func.count(FailedLoginAttempt.id)).where(
        FailedLoginAttempt.email == email.lower().strip(),
        FailedLoginAttempt.attempted_at >= cutoff
    )
    failed_count = db.execute(stmt).scalar() or 0
    if failed_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes."
        )


def record_failed_login(db: Session, email: str, ip_address: Optional[str] = None) -> None:
    attempt = FailedLoginAttempt(
        email=email.lower().strip(),
        attempted_at=utcnow(),
        ip_address=ip_address,
    )
    db.add(attempt)
    db.commit()


def authenticate_user(db: Session, email: str, password: str, ip_address: Optional[str] = None) -> User:
    check_login_throttling(db, email)

    stmt = select(User).where(User.email == email.lower().strip())
    user = db.execute(stmt).scalars().first()

    if not user or not verify_password(password, user.password_hash):
        record_failed_login(db, email, ip_address)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated."
        )

    return user


def create_session(db: Session, user: User) -> Tuple[str, str]:
    jti = uuid.uuid4().hex
    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, jti=jti)

    # Store refresh token hash
    token_hash = hash_token(jti)
    expires_at = utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()

    return access_token, refresh_token


def refresh_session(db: Session, refresh_token_str: str) -> Tuple[str, str, User]:
    try:
        payload = decode_token(refresh_token_str, settings.REFRESH_SECRET_KEY)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type."
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed refresh token."
        )
    user_id = int(sub)
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed refresh token."
        )

    token_hash = hash_token(jti)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    db_token = db.execute(stmt).scalars().first()

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not recognized."
        )

    # Token reuse detection
    if db_token.revoked_at is not None:
        # Revoke all tokens for this user immediately
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).update(
            {"revoked_at": utcnow()}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked refresh token reuse detected. All sessions revoked."
        )

    # Check expiration
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired."
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated."
        )

    # Rotate token: revoke current token
    db_token.revoked_at = utcnow()
    db.commit()

    # Issue new session
    new_access_token, new_refresh_token = create_session(db, user)
    return new_access_token, new_refresh_token, user


def revoke_session(db: Session, refresh_token_str: str) -> None:
    try:
        payload = decode_token(refresh_token_str, settings.REFRESH_SECRET_KEY)
        jti = payload.get("jti")
        if jti:
            token_hash = hash_token(jti)
            db.query(RefreshToken).filter(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None)
            ).update({"revoked_at": utcnow()})
            db.commit()
    except Exception:
        pass


def revoke_all_user_sessions(db: Session, user_id: int) -> int:
    count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": utcnow()})
    db.commit()
    return count


def revoke_other_user_sessions(db: Session, user_id: int, current_refresh_token_str: Optional[str] = None) -> int:
    current_token_hash = None
    if current_refresh_token_str:
        try:
            payload = decode_token(current_refresh_token_str, settings.REFRESH_SECRET_KEY)
            jti = payload.get("jti")
            if jti:
                current_token_hash = hash_token(jti)
        except Exception:
            pass

    query = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    )
    if current_token_hash:
        query = query.filter(RefreshToken.token_hash != current_token_hash)

    count = query.update({"revoked_at": utcnow()})
    db.commit()
    return count


def create_user(db: Session, user_in: UserCreateRequest) -> User:
    email = user_in.email.lower().strip()
    existing = db.execute(select(User).where(User.email == email)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    db_user = User(
        name=user_in.name.strip(),
        email=email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_in: UserUpdateRequest) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user_in.name is not None:
        user.name = user_in.name.strip()
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
        if not user.is_active:
            revoke_all_user_sessions(db, user.id)

    db.commit()
    db.refresh(user)
    return user
