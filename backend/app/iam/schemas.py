from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.iam.models import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.employee


class UserCreateRequest(UserBase):
    password: str


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    display_name: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    model_config = ConfigDict(extra="forbid")


class TokenResponse(BaseModel):
    message: str
    user: UserResponse


class MessageResponse(BaseModel):
    message: str

