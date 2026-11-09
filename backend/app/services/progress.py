"""Learner progress summary and track reset."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.activity import ActivityDaily
from app.models.content import Lesson, Unit
from app.models.gamification import GameScore, LessonProgress, UserBadge, XpEvent
from app.models.user import User
from app.services import lessons as lesson_service
from app.services import xp as xp_service
from app.services.games import GAME_CATALOG

ResetScope = Literal["braille", "cursive", "everything"]

BRAILLE_GAMES = {g["key"] for g in GAME_CATALOG if g["track"] == "braille"}
CURSIVE_GAMES = {g["key"] for g in GAME_CATALOG if g["track"] == "cursive"}
BRAILLE_BADGES = {"first_dot", "alphabet_explorer", "number_cruncher"}
CURSIVE_BADGES = {"first_loop", "cursive_alphabet", "signed_it"}


def _lesson_ids_for_track(db: Session, track: str) -> list[int]:
    rows = db.scalars(
        select(Lesson.id)
        .join(Unit, Unit.id == Lesson.unit_id)
        .where(Unit.track == track)
    ).all()
    return list(rows)


def build_progress(db: Session, user: User) -> dict:
    xp = xp_service.xp_summary(db, user.id)
    badge_count = db.scalar(
        select(func.count()).select_from(UserBadge).where(UserBadge.user_id == user.id)
    )
    active_seconds = db.scalar(
        select(func.coalesce(func.sum(ActivityDaily.active_seconds), 0)).where(
            ActivityDaily.user_id == user.id
        )
    )
    game_scores = []
    for game in GAME_CATALOG:
        best = db.scalar(
            select(func.max(GameScore.score)).where(
                GameScore.user_id == user.id,
                GameScore.game_key == game["key"],
            )
        )
        game_scores.append(
            {
                "game_key": game["key"],
                "title": game["title"],
                "track": game["track"],
                "high_score": int(best or 0),
            }
        )

    tracks = {}
    for track in ("braille", "cursive"):
        try:
            tracks[track] = lesson_service.list_track_curriculum(db, user, track)
        except HTTPException:
            tracks[track] = {"track": track, "units": [], "next_lesson_id": None, "enrolled": False}

    return {
        "total_xp": xp["total_xp"],
        "level": xp["level"],
        "xp_into_level": xp["xp_into_level"],
        "xp_for_next": xp["xp_for_next"],
        "badges_earned": int(badge_count or 0),
        "total_active_seconds": int(active_seconds or 0),
        "game_high_scores": game_scores,
        "tracks": tracks,
    }


def reset_progress(db: Session, user: User, *, scope: ResetScope, confirm: str) -> dict:
    if confirm.strip().upper() != "RESET":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"confirm": "Type RESET to confirm."},
        )
    if scope not in {"braille", "cursive", "everything"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid scope")

    removed = {
        "lesson_progress": 0,
        "game_scores": 0,
        "xp_events": 0,
        "badges": 0,
        "activity_daily": 0,
    }

    if scope in {"braille", "everything"}:
        removed = _reset_track(db, user.id, "braille", removed)
    if scope in {"cursive", "everything"}:
        removed = _reset_track(db, user.id, "cursive", removed)
    if scope == "everything":
        # Wipe remaining XP/badges/activity not tied to a single track.
        xp_deleted = db.execute(delete(XpEvent).where(XpEvent.user_id == user.id))
        removed["xp_events"] += xp_deleted.rowcount or 0
        badge_deleted = db.execute(delete(UserBadge).where(UserBadge.user_id == user.id))
        removed["badges"] += badge_deleted.rowcount or 0
        activity_deleted = db.execute(delete(ActivityDaily).where(ActivityDaily.user_id == user.id))
        removed["activity_daily"] += activity_deleted.rowcount or 0
        # Remaining game scores (if any)
        games_deleted = db.execute(delete(GameScore).where(GameScore.user_id == user.id))
        removed["game_scores"] += games_deleted.rowcount or 0

    db.commit()
    return {"ok": True, "scope": scope, "removed": removed, "progress": build_progress(db, user)}


def _reset_track(db: Session, user_id: uuid.UUID, track: str, removed: dict) -> dict:
    lesson_ids = _lesson_ids_for_track(db, track)
    if lesson_ids:
        result = db.execute(
            delete(LessonProgress).where(
                LessonProgress.user_id == user_id,
                LessonProgress.lesson_id.in_(lesson_ids),
            )
        )
        removed["lesson_progress"] += result.rowcount or 0
        # XP from lessons in this track (ref_id stores lesson id).
        xp_lesson = db.execute(
            delete(XpEvent).where(
                XpEvent.user_id == user_id,
                XpEvent.reason.like("lesson:%"),
                XpEvent.ref_id.in_([str(i) for i in lesson_ids]),
            )
        )
        removed["xp_events"] += xp_lesson.rowcount or 0

    games = BRAILLE_GAMES if track == "braille" else CURSIVE_GAMES
    game_del = db.execute(
        delete(GameScore).where(GameScore.user_id == user_id, GameScore.game_key.in_(games))
    )
    removed["game_scores"] += game_del.rowcount or 0
    xp_games = db.execute(
        delete(XpEvent).where(
            XpEvent.user_id == user_id,
            XpEvent.reason.in_([f"game:{key}" for key in games]),
        )
    )
    removed["xp_events"] += xp_games.rowcount or 0

    badges = BRAILLE_BADGES if track == "braille" else CURSIVE_BADGES
    badge_del = db.execute(
        delete(UserBadge).where(UserBadge.user_id == user_id, UserBadge.badge_key.in_(badges))
    )
    removed["badges"] += badge_del.rowcount or 0

    activity = db.execute(
        delete(ActivityDaily).where(ActivityDaily.user_id == user_id, ActivityDaily.track == track)
    )
    removed["activity_daily"] += activity.rowcount or 0
    return removed
