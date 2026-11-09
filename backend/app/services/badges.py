"""Badge catalog seeding and server-side award evaluation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gamification import Badge, Streak, UserBadge

STARTER_BADGES: list[dict[str, Any]] = [
    {
        "key": "first_dot",
        "title": "First Dot",
        "description": "Pressed your first braille dot.",
        "icon": "dot",
        "criteria": {"type": "manual"},
    },
    {
        "key": "alphabet_explorer",
        "title": "Alphabet Explorer",
        "description": "Learned braille letters a–z.",
        "icon": "alphabet",
        "criteria": {"type": "manual"},
    },
    {
        "key": "number_cruncher",
        "title": "Number Cruncher",
        "description": "Learned braille numbers.",
        "icon": "numbers",
        "criteria": {"type": "manual"},
    },
    {
        "key": "first_loop",
        "title": "First Loop",
        "description": "Traced your first cursive letter.",
        "icon": "loop",
        "criteria": {"type": "manual"},
    },
    {
        "key": "cursive_alphabet",
        "title": "Cursive Alphabet",
        "description": "Traced the full cursive alphabet.",
        "icon": "script",
        "criteria": {"type": "manual"},
    },
    {
        "key": "signed_it",
        "title": "Signed It",
        "description": "Finished Signature Studio.",
        "icon": "signature",
        "criteria": {"type": "manual"},
    },
    {
        "key": "streak_7",
        "title": "7-Day Streak",
        "description": "Practiced on 7 consecutive days.",
        "icon": "streak",
        "criteria": {"type": "streak", "min": 7},
    },
    {
        "key": "streak_30",
        "title": "30-Day Streak",
        "description": "Practiced on 30 consecutive days.",
        "icon": "streak",
        "criteria": {"type": "streak", "min": 30},
    },
    {
        "key": "game_night",
        "title": "Game Night",
        "description": "Played your first game.",
        "icon": "game",
        "criteria": {"type": "manual"},
    },
    {
        "key": "perfect_round",
        "title": "Perfect Round",
        "description": "Scored a perfect game round.",
        "icon": "perfect",
        "criteria": {"type": "manual"},
    },
    {
        "key": "bug_hunter",
        "title": "Bug Hunter",
        "description": "Sent your first bug report.",
        "icon": "bug",
        "criteria": {"type": "manual"},
    },
]


@dataclass(frozen=True)
class BadgeAward:
    key: str
    title: str
    description: str
    icon: str
    earned_at: datetime


def seed_badges(db: Session) -> int:
    created = 0
    for item in STARTER_BADGES:
        existing = db.get(Badge, item["key"])
        if existing is None:
            db.add(
                Badge(
                    key=item["key"],
                    title=item["title"],
                    description=item["description"],
                    icon=item["icon"],
                    criteria=item["criteria"],
                )
            )
            created += 1
        else:
            existing.title = item["title"]
            existing.description = item["description"]
            existing.icon = item["icon"]
            existing.criteria = item["criteria"]
    db.commit()
    return created


def list_user_badges(db: Session, user_id: uuid.UUID, *, limit: int | None = None) -> list[BadgeAward]:
    stmt = (
        select(UserBadge, Badge)
        .join(Badge, Badge.key == UserBadge.badge_key)
        .where(UserBadge.user_id == user_id)
        .order_by(UserBadge.earned_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = db.execute(stmt).all()
    return [
        BadgeAward(
            key=badge.key,
            title=badge.title,
            description=badge.description,
            icon=badge.icon,
            earned_at=ub.earned_at,
        )
        for ub, badge in rows
    ]


def award_badge(
    db: Session,
    *,
    user_id: uuid.UUID,
    badge_key: str,
    commit: bool = True,
) -> BadgeAward | None:
    badge = db.get(Badge, badge_key)
    if badge is None:
        return None
    existing = db.get(UserBadge, (user_id, badge_key))
    if existing is not None:
        return None
    now = datetime.now(UTC)
    row = UserBadge(user_id=user_id, badge_key=badge_key, earned_at=now)
    db.add(row)
    if commit:
        db.commit()
    else:
        db.flush()
    return BadgeAward(
        key=badge.key,
        title=badge.title,
        description=badge.description,
        icon=badge.icon,
        earned_at=now,
    )


def evaluate_badges(db: Session, user_id: uuid.UUID) -> list[BadgeAward]:
    """Award any badges whose criteria are newly met."""
    owned = {
        key
        for key in db.scalars(select(UserBadge.badge_key).where(UserBadge.user_id == user_id)).all()
    }
    streak = db.get(Streak, user_id)
    current_streak = streak.current if streak else 0
    newly: list[BadgeAward] = []

    for badge in db.scalars(select(Badge)).all():
        if badge.key in owned:
            continue
        criteria = badge.criteria or {}
        kind = criteria.get("type")
        earned = False
        if kind == "streak":
            earned = current_streak >= int(criteria.get("min", 9999))
        if earned:
            award = award_badge(db, user_id=user_id, badge_key=badge.key, commit=False)
            if award is not None:
                newly.append(award)
    if newly:
        db.commit()
    return newly
