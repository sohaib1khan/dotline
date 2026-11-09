"""Game catalog, unlock rules, and score persistence."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.content import Lesson, Unit
from app.models.gamification import GameScore, LessonProgress
from app.models.user import User
from app.services import badges as badge_service
from app.services import tracks as track_service
from app.services import xp as xp_service

GAME_CATALOG = [
    {
        "key": "dot_drop",
        "title": "Dot Drop",
        "track": "braille",
        "description": "Letters fall — type the chord before they land.",
        "duration_s": 75,
    },
    {
        "key": "cell_match",
        "title": "Cell Match",
        "track": "braille",
        "description": "Match braille cells to letters from memory.",
        "duration_s": 90,
    },
    {
        "key": "lantern_path",
        "title": "Lantern Path",
        "track": "cursive",
        "description": "Trace the letter path to light the lanterns.",
        "duration_s": 90,
    },
    {
        "key": "word_weaver",
        "title": "Word Weaver",
        "track": "cursive",
        "description": "Write a short word in cursive against the clock.",
        "duration_s": 90,
    },
]


@dataclass(frozen=True)
class ScoreResult:
    game_key: str
    score: int
    accuracy: float | None
    duration_s: int | None
    xp_awarded: int
    leveled_up: bool
    level: int | None
    high_score: int
    new_badges: list


def _unit1_complete(db: Session, user_id: uuid.UUID, track: str) -> bool:
    unit = db.scalar(
        select(Unit)
        .where(Unit.track == track, Unit.order == 1, Unit.is_published.is_(True))
        .options(selectinload(Unit.lessons))
    )
    if unit is None:
        return False
    review = next((lesson for lesson in unit.lessons if lesson.type == "review" and lesson.is_published), None)
    if review is None:
        published = [lesson for lesson in unit.lessons if lesson.is_published]
        if not published:
            return False
        for lesson in published:
            progress = db.get(LessonProgress, (user_id, lesson.id))
            if progress is None or progress.status not in {"completed", "mastered"}:
                return False
        return True
    progress = db.get(LessonProgress, (user_id, review.id))
    if progress is None or progress.status not in {"completed", "mastered"}:
        return False
    return float(progress.best_score or 0) >= 80.0


def progress_level(db: Session, user_id: uuid.UUID, track: str) -> int:
    """Difficulty 1–5 from completed lessons in the track."""
    completed = db.scalar(
        select(func.count())
        .select_from(LessonProgress)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Unit, Unit.id == Lesson.unit_id)
        .where(
            LessonProgress.user_id == user_id,
            Unit.track == track,
            LessonProgress.status.in_(("completed", "mastered")),
        )
    )
    count = int(completed or 0)
    if count >= 20:
        return 5
    if count >= 12:
        return 4
    if count >= 6:
        return 3
    if count >= 2:
        return 2
    return 1


def high_score(db: Session, user_id: uuid.UUID, game_key: str) -> int:
    value = db.scalar(
        select(func.max(GameScore.score)).where(
            GameScore.user_id == user_id,
            GameScore.game_key == game_key,
        )
    )
    return int(value or 0)


def list_games(db: Session, user: User) -> list[dict]:
    enrolled = set(track_service.list_tracks(db, user.id))
    out = []
    for game in GAME_CATALOG:
        track = game["track"]
        unlocked = (
            user.role == "admin"
            or (track in enrolled and _unit1_complete(db, user.id, track))
        )
        out.append(
            {
                **game,
                "unlocked": unlocked,
                "lock_reason": None
                if unlocked
                else f"Complete Unit 1 of {track.title()} to unlock.",
                "high_score": high_score(db, user.id, game["key"]),
                "difficulty": progress_level(db, user.id, track) if unlocked else 1,
            }
        )
    return out


def require_game(db: Session, user: User, game_key: str) -> dict:
    games = {item["key"]: item for item in list_games(db, user)}
    game = games.get(game_key)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown game")
    if not game["unlocked"] and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=game["lock_reason"])
    return game


def submit_score(
    db: Session,
    user: User,
    *,
    game_key: str,
    score: int,
    accuracy: float | None,
    duration_s: int | None,
) -> ScoreResult:
    game = require_game(db, user, game_key)
    score = max(0, min(100000, int(score)))
    acc = None if accuracy is None else max(0.0, min(100.0, float(accuracy)))
    db.add(
        GameScore(
            user_id=user.id,
            game_key=game_key,
            score=score,
            accuracy=acc,
            duration_s=duration_s,
        )
    )
    # XP: scale by score and difficulty.
    difficulty = int(game["difficulty"])
    amount = max(5, round((score / 100.0) * (8 + difficulty * 4)))
    award = xp_service.award_xp(
        db,
        user_id=user.id,
        amount=amount,
        reason=f"game:{game_key}",
        ref_id=game_key,
        commit=False,
    )
    new_badges = []
    badge = badge_service.award_badge(db, user_id=user.id, badge_key="game_night", commit=False)
    if badge:
        new_badges.append(badge)
    if acc is not None and acc >= 100:
        perfect = badge_service.award_badge(
            db, user_id=user.id, badge_key="perfect_round", commit=False
        )
        if perfect:
            new_badges.append(perfect)
    new_badges.extend(badge_service.evaluate_badges(db, user.id))
    db.commit()
    return ScoreResult(
        game_key=game_key,
        score=score,
        accuracy=acc,
        duration_s=duration_s,
        xp_awarded=amount,
        leveled_up=award.leveled_up,
        level=award.level,
        high_score=high_score(db, user.id, game_key),
        new_badges=new_badges,
    )
