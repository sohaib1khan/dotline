"""Admin debug helpers: grant XP for celebration testing."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.gamification import GrantXpRequest, GrantXpResponse
from app.security.deps import require_admin, require_csrf
from app.services import badges as badge_service
from app.services import xp as xp_service

router = APIRouter(prefix="/api/admin/debug", tags=["admin-debug"])


@router.post("/xp", response_model=GrantXpResponse, dependencies=[Depends(require_csrf)])
def grant_xp(
    payload: GrantXpRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> GrantXpResponse:
    target = admin
    if payload.user_id:
        try:
            target_id = uuid.UUID(payload.user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"user_id": "Invalid user id."},
            ) from exc
        found = db.get(User, target_id)
        if found is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        target = found

    result = xp_service.award_xp(
        db,
        user_id=target.id,
        amount=payload.amount,
        reason=payload.reason,
        ref_id=f"admin:{admin.id}",
    )
    new_badges = badge_service.evaluate_badges(db, target.id)
    return GrantXpResponse(
        amount=result.amount,
        reason=result.reason,
        total_xp=result.total_xp,
        previous_level=result.previous_level,
        level=result.level,
        xp_into_level=result.xp_into_level,
        xp_for_next=result.xp_for_next,
        leveled_up=result.leveled_up,
        levels_gained=result.levels_gained,
        new_badges=[
            {
                "key": b.key,
                "title": b.title,
                "description": b.description,
                "icon": b.icon,
                "earned_at": b.earned_at,
            }
            for b in new_badges
        ],
    )
