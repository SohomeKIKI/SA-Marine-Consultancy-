from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.iam.models import UserRole
from app.iam.schemas import UserResponse


class AdminUserCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    role: UserRole = UserRole.employee
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


class AdminUserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None


class AdminResetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


class PaginatedUsers(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    limit: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
