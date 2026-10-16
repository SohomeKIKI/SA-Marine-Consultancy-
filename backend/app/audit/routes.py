import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.iam.models import User
from app.audit import service
from app.audit.schemas import PaginatedAuditLogs, AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/logs", response_model=PaginatedAuditLogs)
def get_audit_logs(
    user_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    items, total = service.get_audit_logs(
        db=db,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )
    pages = math.ceil(total / limit) if total > 0 else 1
    return PaginatedAuditLogs(
        items=[AuditLogResponse.model_validate(log) for log in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )
