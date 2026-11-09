"""Learner lesson catalog and completion routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.lessons import (
    LessonCompleteRequest,
    LessonCompleteResponse,
    LessonDetailResponse,
    TrackCurriculumResponse,
)
from app.security.deps import get_current_user, require_csrf
from app.services import lessons as lesson_service

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("/track/{track}", response_model=TrackCurriculumResponse)
def get_track_curriculum(
    track: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TrackCurriculumResponse:
    return TrackCurriculumResponse(**lesson_service.list_track_curriculum(db, user, track.lower()))


@router.get("/{lesson_id}", response_model=LessonDetailResponse)
def get_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LessonDetailResponse:
    return LessonDetailResponse(**lesson_service.get_lesson_for_user(db, user, lesson_id))


@router.post(
    "/{lesson_id}/complete",
    response_model=LessonCompleteResponse,
    dependencies=[Depends(require_csrf)],
)
def complete_lesson(
    lesson_id: int,
    payload: LessonCompleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LessonCompleteResponse:
    result = lesson_service.complete_lesson(
        db,
        user,
        lesson_id=lesson_id,
        score=payload.score,
        correct=payload.correct,
        total=payload.total,
    )
    return LessonCompleteResponse(**result)
