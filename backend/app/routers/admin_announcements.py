"""Admin announcements routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.announcements import AnnouncementCreateRequest, AnnouncementResponse
from app.security.deps import require_admin, require_csrf
from app.services import announcements as announcements_service

router = APIRouter(prefix="/api/admin/announcements", tags=["admin-announcements"])


@router.post("", response_model=AnnouncementResponse, dependencies=[Depends(require_csrf)])
def create_announcement(
    payload: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AnnouncementResponse:
    result = announcements_service.broadcast(
        db, admin, title=payload.title, body=payload.body
    )
    return AnnouncementResponse(**result)
