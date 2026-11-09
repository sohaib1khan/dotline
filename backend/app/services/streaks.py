"""Practice streak tracking (≥ 5 active minutes on consecutive days)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.activity import ActivityDaily
from app.models.gamification import Streak

STREAK_MIN_SECONDS = 5 * 60


@dataclass(frozen=True)
class StreakSnapshot:
    current: int
    longest: int
    last_active_date: date | None


def get_or_create_streak(db: Session, user_id: uuid.UUID) -> Streak:
    row = db.get(Streak, user_id)
    if row is None:
        row = Streak(user_id=user_id, current=0, longest=0, last_active_date=None)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def today_active_seconds(db: Session, user_id: uuid.UUID, *, on: date | None = None) -> int:
    day = on or datetime.now(UTC).date()
    total = db.scalar(
        select(func.coalesce(func.sum(ActivityDaily.active_seconds), 0)).where(
            ActivityDaily.user_id == user_id,
            ActivityDaily.date == day,
        )
    )
    return int(total or 0)


def refresh_streak(db: Session, user_id: uuid.UUID, *, on: date | None = None) -> StreakSnapshot:
    """Recompute streak from activity_daily. Qualifying day = ≥ 5 active minutes."""
    day = on or datetime.now(UTC).date()
    row = get_or_create_streak(db, user_id)

    seconds_today = today_active_seconds(db, user_id, on=day)
    if seconds_today < STREAK_MIN_SECONDS:
        # Streak breaks if the last qualifying day was before yesterday.
        if row.last_active_date is not None and row.last_active_date < day - timedelta(days=1):
            row.current = 0
            db.commit()
        return StreakSnapshot(
            current=row.current,
            longest=row.longest,
            last_active_date=row.last_active_date,
        )

    if row.last_active_date == day:
        return StreakSnapshot(
            current=row.current,
            longest=row.longest,
            last_active_date=row.last_active_date,
        )

    if row.last_active_date == day - timedelta(days=1):
        row.current += 1
    else:
        row.current = 1
    row.last_active_date = day
    row.longest = max(row.longest, row.current)
    db.commit()
    db.refresh(row)
    return StreakSnapshot(
        current=row.current,
        longest=row.longest,
        last_active_date=row.last_active_date,
    )


def streak_snapshot(db: Session, user_id: uuid.UUID) -> StreakSnapshot:
    row = get_or_create_streak(db, user_id)
    return StreakSnapshot(
        current=row.current,
        longest=row.longest,
        last_active_date=row.last_active_date,
    )
