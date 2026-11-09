"""XP awards and level math (server-side only)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.gamification import XpEvent


def xp_to_advance(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    if level < 1:
        raise ValueError("level must be >= 1")
    return int(round(100 * (level**1.5)))


def level_progress(total_xp: int) -> tuple[int, int, int]:
    """Return (level, xp_into_current_level, xp_needed_for_next)."""
    remaining = max(0, total_xp)
    level = 1
    while True:
        need = xp_to_advance(level)
        if remaining < need:
            return level, remaining, need
        remaining -= need
        level += 1


def total_xp_for_user(db: Session, user_id: uuid.UUID) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id)
    )
    return int(total or 0)


@dataclass(frozen=True)
class AwardResult:
    amount: int
    reason: str
    total_xp: int
    previous_level: int
    level: int
    xp_into_level: int
    xp_for_next: int
    leveled_up: bool
    levels_gained: int


def award_xp(
    db: Session,
    *,
    user_id: uuid.UUID,
    amount: int,
    reason: str,
    ref_id: str | None = None,
    commit: bool = True,
) -> AwardResult:
    if amount <= 0:
        raise ValueError("XP amount must be positive")
    if len(reason) > 128:
        raise ValueError("reason too long")

    before = total_xp_for_user(db, user_id)
    previous_level, _, _ = level_progress(before)

    db.add(
        XpEvent(
            user_id=user_id,
            amount=amount,
            reason=reason,
            ref_id=ref_id,
        )
    )
    if commit:
        db.commit()
    else:
        db.flush()

    after = before + amount
    level, into, need = level_progress(after)
    levels_gained = level - previous_level
    return AwardResult(
        amount=amount,
        reason=reason,
        total_xp=after,
        previous_level=previous_level,
        level=level,
        xp_into_level=into,
        xp_for_next=need,
        leveled_up=levels_gained > 0,
        levels_gained=levels_gained,
    )


def xp_summary(db: Session, user_id: uuid.UUID) -> dict:
    total = total_xp_for_user(db, user_id)
    level, into, need = level_progress(total)
    return {
        "total_xp": total,
        "level": level,
        "xp_into_level": into,
        "xp_for_next": need,
        "progress_ratio": 0.0 if need <= 0 else min(1.0, into / need),
    }
