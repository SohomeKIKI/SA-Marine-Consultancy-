import calendar
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import (
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base

if TYPE_CHECKING:
    from app.students.models import Student


def utcnow():
    return datetime.now(timezone.utc)


def format_batch_name(month: int, year: int) -> str:
    month_name = calendar.month_name[month]
    return f"{month_name} {year}"


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 - 12
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("month", "year", name="uq_batch_month_year"),
    )

    # Relationships
    batch_colleges: Mapped[List["BatchCollege"]] = relationship("BatchCollege", back_populates="batch", cascade="all, delete-orphan")


class College(Base):
    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    batch_colleges: Mapped[List["BatchCollege"]] = relationship("BatchCollege", back_populates="college")


class BatchCollege(Base):
    __tablename__ = "batch_colleges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    college_id: Mapped[int] = mapped_column(Integer, ForeignKey("colleges.id", ondelete="RESTRICT"), nullable=False, index=True)
    added_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("batch_id", "college_id", name="uq_batch_college"),
    )

    # Relationships
    batch: Mapped["Batch"] = relationship("Batch", back_populates="batch_colleges")
    college: Mapped["College"] = relationship("College", back_populates="batch_colleges")
    students: Mapped[List["Student"]] = relationship("Student", back_populates="batch_college")
