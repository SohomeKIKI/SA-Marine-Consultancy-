from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator, ConfigDict
from app.payments.models import PaymentMode


class PaymentCreate(BaseModel):
    student_id: int
    amount: Decimal = Field(..., gt=Decimal("0"), description="Amount must be strictly greater than 0")
    payment_date: Optional[datetime] = None
    mode: PaymentMode
    online_account: Optional[str] = None

    @model_validator(mode="after")
    def check_online_account(self):
        if self.mode in (PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK_TRANSFER):
            if not self.online_account or not self.online_account.strip():
                raise ValueError(f"online_account is required when mode is {self.mode.value}")
        return self


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=Decimal("0"))
    payment_date: Optional[datetime] = None
    mode: Optional[PaymentMode] = None
    online_account: Optional[str] = None

    @model_validator(mode="after")
    def check_online_account(self):
        if self.mode is not None and self.mode in (PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK_TRANSFER):
            if not self.online_account or not self.online_account.strip():
                raise ValueError(f"online_account is required when mode is {self.mode.value}")
        return self


class PaymentResponse(BaseModel):
    id: int
    student_id: int
    amount: Decimal
    payment_date: datetime
    mode: PaymentMode
    online_account: Optional[str] = None
    recorded_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentTotalsResponse(BaseModel):
    student_id: int
    student_number: str
    total_required: Decimal
    total_paid: Decimal
    total_due: Decimal
