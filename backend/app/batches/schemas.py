from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class CollegeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)


class CollegeCreate(CollegeBase):
    pass


class CollegeResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchCreate(BaseModel):
    month: int = Field(..., ge=1, le=12, description="Month 1 to 12")
    year: int = Field(..., ge=2000, le=2100, description="Four-digit year")


class BatchCollegeResponse(BaseModel):
    id: int
    batch_id: int
    college_id: int
    college_name: str
    college_is_active: bool
    added_by: int
    added_at: datetime
    student_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class BatchResponse(BaseModel):
    id: int
    name: str
    month: int
    year: int
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchDetailResponse(BatchResponse):
    colleges: List[BatchCollegeResponse] = []


class LinkCollegeRequest(BaseModel):
    college_id: int
