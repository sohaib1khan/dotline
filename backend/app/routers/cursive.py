"""Cursive stroke library and Signature Studio endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.content import Lesson
from app.models.signatures import SignaturePractice
from app.models.user import User
from app.security.deps import get_current_user, require_csrf
from app.services import content_seed
from app.services import lessons as lesson_service

router = APIRouter(prefix="/api/cursive", tags=["cursive"])


class SignatureCreateRequest(BaseModel):
    name_text: str = Field(min_length=1, max_length=120)
    strokes: list[dict] = Field(default_factory=list)
    score: float | None = Field(default=None, ge=0, le=100)
    complete_lesson_id: int | None = None


class SignaturePublic(BaseModel):
    id: uuid.UUID
    name_text: str
    score: float | None
    created_at: datetime


@router.get("/strokes")
def get_strokes(_: User = Depends(get_current_user)) -> dict:
    return content_seed.load_cursive_strokes()


@router.get("/signatures", response_model=list[SignaturePublic])
def list_signatures(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SignaturePublic]:
    rows = db.scalars(
        select(SignaturePractice)
        .where(SignaturePractice.user_id == user.id)
        .order_by(SignaturePractice.created_at.desc())
        .limit(20)
    ).all()
    return [
        SignaturePublic(
            id=row.id,
            name_text=row.name_text,
            score=row.score,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/signatures", dependencies=[Depends(require_csrf)])
def save_signature(
    payload: SignatureCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = SignaturePractice(
        user_id=user.id,
        name_text=payload.name_text.strip(),
        strokes=payload.strokes,
        score=payload.score,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    completion = None
    lesson_id = payload.complete_lesson_id
    if lesson_id is None:
        # Auto-complete the Signature Studio lesson if available.
        lesson = db.scalar(
            select(Lesson)
            .where(Lesson.type == "signature", Lesson.is_published.is_(True))
            .limit(1)
        )
        if lesson is not None:
            lesson_id = lesson.id
    if lesson_id is not None:
        try:
            completion = lesson_service.complete_lesson(
                db,
                user,
                lesson_id=lesson_id,
                score=float(payload.score or 80),
                correct=1,
                total=1,
            )
        except HTTPException:
            completion = None

    return {
        "id": str(row.id),
        "name_text": row.name_text,
        "score": row.score,
        "created_at": row.created_at.isoformat(),
        "completion": completion,
    }
