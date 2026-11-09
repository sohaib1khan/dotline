"""Learner progress summary and reset."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.progress import ProgressResponse, ResetProgressRequest, ResetProgressResponse
from app.security.deps import get_current_user, require_csrf
from app.services import progress as progress_service

router = APIRouter(prefix="/api/me", tags=["progress"])


@router.get("/progress", response_model=ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    return ProgressResponse(**progress_service.build_progress(db, user))


@router.post(
    "/progress/reset",
    response_model=ResetProgressResponse,
    dependencies=[Depends(require_csrf)],
)
def reset_progress(
    payload: ResetProgressRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResetProgressResponse:
    result = progress_service.reset_progress(
        db,
        user,
        scope=payload.scope,
        confirm=payload.confirm,
    )
    return ResetProgressResponse(**result)
