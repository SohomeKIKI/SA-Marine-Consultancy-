from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.students.models import CourseType


class StudentBase(BaseModel):
    batch_college_id: int
    name: str = Field(..., min_length=1, max_length=255)
    course: CourseType
    agent_name: Optional[str] = Field(None, max_length=255)
    total_required: Decimal = Field(Decimal("0.00"), ge=Decimal("0"))
    custom_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    batch_college_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    course: Optional[CourseType] = None
    agent_name: Optional[str] = None
    total_required: Optional[Decimal] = Field(None, ge=Decimal("0"))
    custom_data: Optional[Dict[str, Any]] = None


class StudentResponse(BaseModel):
    id: int
    student_number: str
    batch_college_id: int
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None
    college_id: Optional[int] = None
    college_name: Optional[str] = None
    name: str
    course: CourseType
    agent_name: Optional[str] = None
    total_required: Decimal
    total_paid: Decimal = Decimal("0.00")
    total_due: Decimal = Decimal("0.00")
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedStudents(BaseModel):
    items: List[StudentResponse]
    total: int
    page: int
    limit: int
    pages: int
