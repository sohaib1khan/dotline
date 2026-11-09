"""Track enrollment routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.gamification import TracksResponse, TracksUpdateRequest
from app.security.deps import get_current_user, require_csrf
from app.services import tracks as track_service

router = APIRouter(prefix="/api/me", tags=["tracks"])


@router.get("/tracks", response_model=TracksResponse)
def get_tracks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TracksResponse:
    return TracksResponse(tracks=track_service.list_tracks(db, user.id))


@router.put("/tracks", response_model=TracksResponse, dependencies=[Depends(require_csrf)])
def put_tracks(
    payload: TracksUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TracksResponse:
    tracks = track_service.set_tracks(db, user.id, payload.tracks)
    return TracksResponse(tracks=tracks)
