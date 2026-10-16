from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin, require_employee_or_admin
from app.iam.models import User
from app.batches import service
from app.batches.schemas import (
    BatchCreate,
    BatchResponse,
    BatchDetailResponse,
    CollegeCreate,
    CollegeResponse,
    BatchCollegeResponse,
    LinkCollegeRequest,
)

router = APIRouter(tags=["Batches & Colleges"])


# ---- Batches Routes ----

@router.get("/batches", response_model=List[BatchResponse])
def get_batches(
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.list_batches(db)


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch_in: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return service.create_batch(db, batch_in, current_user)


@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    batch = service.get_batch_by_id(db, batch_id)
    linked = service.get_batch_colleges(db, batch_id)
    return BatchDetailResponse(
        id=batch.id,
        name=batch.name,
        month=batch.month,
        year=batch.year,
        created_by=batch.created_by,
        created_at=batch.created_at,
        colleges=linked,
    )


@router.get("/batches/{batch_id}/colleges", response_model=List[BatchCollegeResponse])
def get_batch_colleges(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.get_batch_colleges(db, batch_id)


@router.post("/batches/{batch_id}/colleges", status_code=status.HTTP_201_CREATED)
def link_college(
    batch_id: int,
    link_in: LinkCollegeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service.link_college_to_batch(db, batch_id, link_in.college_id, current_user)
    return {"message": "College successfully linked to batch"}


@router.delete("/batches/{batch_id}/colleges/{college_id}", status_code=status.HTTP_200_OK)
def unlink_college(
    batch_id: int,
    college_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service.unlink_college_from_batch(db, batch_id, college_id, current_user)
    return {"message": "College successfully unlinked from batch"}


# ---- Colleges Routes ----

@router.get("/colleges", response_model=List[CollegeResponse])
def get_colleges(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_employee_or_admin),
):
    return service.list_colleges(db, active_only=active_only)


@router.post("/colleges", response_model=CollegeResponse, status_code=status.HTTP_201_CREATED)
def create_college(
    college_in: CollegeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return service.create_college(db, college_in, current_user)


@router.patch("/colleges/{college_id}/deactivate", response_model=CollegeResponse)
def deactivate_college(
    college_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return service.deactivate_college(db, college_id, current_user)
