"""Aggregate learner home (statusboard) payload."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.services import badges as badge_service
from app.services import inbox as inbox_service
from app.services import lessons as lesson_service
from app.services import streaks as streak_service
from app.services import tracks as track_service
from app.services import user_settings as settings_service
from app.services import xp as xp_service


def build_statusboard(db: Session, user: User) -> dict:
    settings = settings_service.get_or_create_settings(db, user)
    streak_service.refresh_streak(db, user.id)
    streak = streak_service.streak_snapshot(db, user.id)
    xp = xp_service.xp_summary(db, user.id)
    latest_badges = badge_service.list_user_badges(db, user.id, limit=6)
    enrolled = track_service.list_tracks(db, user.id)
    active_seconds = streak_service.today_active_seconds(db, user.id)
    goal_minutes = settings.daily_goal_minutes
    goal_seconds = max(1, goal_minutes * 60)

    return {
        "first_name": user.first_name,
        "tracks": enrolled,
        "level": xp["level"],
        "total_xp": xp["total_xp"],
        "xp_into_level": xp["xp_into_level"],
        "xp_for_next": xp["xp_for_next"],
        "xp_progress_ratio": xp["progress_ratio"],
        "streak_current": streak.current,
        "streak_longest": streak.longest,
        "daily_goal_minutes": goal_minutes,
        "today_active_seconds": active_seconds,
        "daily_goal_ratio": min(1.0, active_seconds / goal_seconds),
        "unread_inbox": inbox_service.unread_count(db, user.id),
        "latest_badges": [
            {
                "key": b.key,
                "title": b.title,
                "description": b.description,
                "icon": b.icon,
                "earned_at": b.earned_at.isoformat(),
            }
            for b in latest_badges
        ],
        "continue_targets": _continue_targets(db, user, enrolled),
    }


def _continue_targets(db: Session, user: User, enrolled: list[str]) -> list[dict]:
    targets: list[dict] = []
    for track in enrolled:
        path = lesson_service.next_track_lesson_path(db, user, track) or f"/app/{track}"
        hint = (
            "Jump back into your next unlocked braille lesson."
            if track == "braille"
            else "Jump back into your next unlocked cursive lesson."
        )
        targets.append(
            {
                "track": track,
                "label": "Continue Braille" if track == "braille" else "Continue Cursive",
                "path": path,
                "hint": hint,
            }
        )
    return targets
