"""Learner statusboard summary."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.gamification import StatusboardResponse
from app.security.deps import get_current_user
from app.services import statusboard as statusboard_service

router = APIRouter(prefix="/api/me", tags=["statusboard"])


@router.get("/statusboard", response_model=StatusboardResponse)
def get_statusboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StatusboardResponse:
    return StatusboardResponse(**statusboard_service.build_statusboard(db, user))
