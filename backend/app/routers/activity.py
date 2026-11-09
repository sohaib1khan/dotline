"""Learner activity heartbeat routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.activity import HeartbeatRequest, HeartbeatResponse
from app.security.deps import get_current_user, require_csrf
from app.services import activity as activity_service

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.post("/heartbeat", response_model=HeartbeatResponse, dependencies=[Depends(require_csrf)])
def heartbeat(
    payload: HeartbeatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HeartbeatResponse:
    result = activity_service.record_heartbeat(
        db,
        user.id,
        track=payload.track,
        page=payload.page,
    )
    return HeartbeatResponse(**result)
