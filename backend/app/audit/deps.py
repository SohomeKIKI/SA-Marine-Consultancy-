from typing import Callable
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_active_user
from app.iam.models import User
from app.audit import service


def audit_view(entity_type: str, id_param: str = "id") -> Callable:
    """
    FastAPI dependency that logs a view action for a specific entity on GET requests.
    Runs inside the request transaction and commits the view log.
    """
    def _audit_dependency(
        request: Request,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user),
    ):
        entity_id = request.path_params.get(id_param)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        service.record(
            db=db,
            user=current_user,
            action="view",
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        db.commit()

    return _audit_dependency
