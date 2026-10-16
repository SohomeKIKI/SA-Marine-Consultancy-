import enum
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import (
    Integer,
    String,
    Numeric,
    DateTime,
    Enum,
    ForeignKey,
    JSON,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base
from app.payments.models import Payment

if TYPE_CHECKING:
    from app.batches.models import BatchCollege


def utcnow():
    return datetime.now(timezone.utc)


class CourseType(str, enum.Enum):
    GP_RATING = "GP_RATING"
    CCMS = "CCMS"
    ETO = "ETO"
    DNS = "DNS"
    BSC = "BSC"
    CHHOTI_TRAINING = "CHHOTI_TRAINING"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_college_id: Mapped[int] = mapped_column(Integer, ForeignKey("batch_colleges.id", ondelete="RESTRICT"), nullable=False, index=True)
    student_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    course: Mapped[CourseType] = mapped_column(Enum(CourseType, name="course_type", native_enum=False), nullable=False)
    agent_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    total_required: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    custom_data: Mapped[Dict[str, Any]] = mapped_column(JSON().with_variant(postgresql.JSONB, "postgresql"), nullable=False, default=dict)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    batch_college: Mapped["BatchCollege"] = relationship("BatchCollege", back_populates="students")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="student", cascade="all, delete-orphan")
