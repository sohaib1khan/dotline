"""Learner active-time heartbeats, sessions, and daily rollups."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity import ActivityDaily, ActivitySession
from app.services import streaks as streak_service

SESSION_GAP = timedelta(seconds=120)
HEARTBEAT_CAP_SECONDS = 35


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _track_key(track: str | None) -> str:
    if track in {"braille", "cursive"}:
        return track
    return "general"


def _add_daily(
    db: Session,
    *,
    user_id: uuid.UUID,
    day: date,
    track: str,
    seconds: int,
) -> None:
    if seconds <= 0:
        return
    key = _track_key(track)
    row = db.get(ActivityDaily, (user_id, day, key))
    if row is None:
        row = ActivityDaily(user_id=user_id, date=day, track=key, active_seconds=seconds)
        db.add(row)
    else:
        row.active_seconds += seconds


def record_heartbeat(
    db: Session,
    user_id: uuid.UUID,
    *,
    track: str | None,
    page: str | None,
) -> dict:
    now = _utcnow()
    page_value = (page or "")[:200] or None
    track_value = track if track in {"braille", "cursive"} else None

    open_session = db.scalar(
        select(ActivitySession)
        .where(
            ActivitySession.user_id == user_id,
            ActivitySession.last_heartbeat_at >= now - SESSION_GAP,
        )
        .order_by(ActivitySession.last_heartbeat_at.desc())
        .limit(1)
    )

    added = 0
    if open_session is None:
        session = ActivitySession(
            user_id=user_id,
            started_at=now,
            last_heartbeat_at=now,
            active_seconds=0,
            track=track_value,
            page=page_value,
        )
        db.add(session)
    else:
        elapsed = int((now - open_session.last_heartbeat_at).total_seconds())
        added = max(0, min(elapsed, HEARTBEAT_CAP_SECONDS))
        open_session.active_seconds += added
        open_session.last_heartbeat_at = now
        open_session.track = track_value or open_session.track
        open_session.page = page_value or open_session.page
        session = open_session
        _add_daily(
            db,
            user_id=user_id,
            day=now.date(),
            track=track_value or open_session.track or "general",
            seconds=added,
        )

    db.commit()
    db.refresh(session)
    if added > 0:
        streak_service.refresh_streak(db, user_id)

    return {
        "session_id": str(session.id),
        "added_seconds": added,
        "session_active_seconds": session.active_seconds,
        "last_heartbeat_at": session.last_heartbeat_at.isoformat(),
    }


def rollup_sessions(
    db: Session,
    *,
    since: datetime | None = None,
) -> dict:
    """On-demand rollup helper: ensure daily rows cover recent sessions.

    Heartbeats already write daily rows; this recomputes from sessions for a window.
    """
    window_start = since or (_utcnow() - timedelta(days=2))
    sessions = db.scalars(
        select(ActivitySession).where(ActivitySession.last_heartbeat_at >= window_start)
    ).all()
    # Rebuild affected daily keys from session totals is lossy across days;
    # instead only top-up missing general rows for sessions with seconds and no daily.
    touched = 0
    for session in sessions:
        if session.active_seconds <= 0:
            continue
        day = session.started_at.astimezone(UTC).date()
        track = _track_key(session.track)
        existing = db.get(ActivityDaily, (session.user_id, day, track))
        if existing is None:
            db.add(
                ActivityDaily(
                    user_id=session.user_id,
                    date=day,
                    track=track,
                    active_seconds=session.active_seconds,
                )
            )
            touched += 1
    db.commit()
    return {"ok": True, "created_rows": touched}


def active_user_ids(db: Session, *, within_seconds: int = 120) -> list[uuid.UUID]:
    since = _utcnow() - timedelta(seconds=within_seconds)
    rows = db.scalars(
        select(ActivitySession.user_id)
        .where(ActivitySession.last_heartbeat_at >= since)
        .distinct()
    ).all()
    return list(rows)
