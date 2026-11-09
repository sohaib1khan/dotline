"""Learner track enrollment (braille / cursive)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Track, UserTrack

VALID_TRACKS = {Track.BRAILLE.value, Track.CURSIVE.value}


def list_tracks(db: Session, user_id: uuid.UUID) -> list[str]:
    rows = db.scalars(
        select(UserTrack.track).where(UserTrack.user_id == user_id).order_by(UserTrack.track)
    ).all()
    return list(rows)


def set_tracks(db: Session, user_id: uuid.UUID, tracks: list[str]) -> list[str]:
    normalized = sorted({t.strip().lower() for t in tracks})
    invalid = [t for t in normalized if t not in VALID_TRACKS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"tracks": f"Invalid track(s): {', '.join(invalid)}"},
        )
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"tracks": "Pick at least one track."},
        )

    existing = {
        row.track: row
        for row in db.scalars(select(UserTrack).where(UserTrack.user_id == user_id)).all()
    }
    for track in list(existing):
        if track not in normalized:
            db.delete(existing[track])
    now = datetime.now(UTC)
    for track in normalized:
        if track not in existing:
            db.add(UserTrack(user_id=user_id, track=track, enrolled_at=now))
    db.commit()
    return list_tracks(db, user_id)


def add_track(db: Session, user_id: uuid.UUID, track: str) -> list[str]:
    key = track.strip().lower()
    if key not in VALID_TRACKS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"track": "Track must be braille or cursive."},
        )
    current = list_tracks(db, user_id)
    if key not in current:
        current.append(key)
    return set_tracks(db, user_id, current)


def remove_track(db: Session, user_id: uuid.UUID, track: str) -> list[str]:
    key = track.strip().lower()
    current = [t for t in list_tracks(db, user_id) if t != key]
    if not current:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"track": "Keep at least one track enrolled."},
        )
    return set_tracks(db, user_id, current)
