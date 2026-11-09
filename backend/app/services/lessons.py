"""Lesson catalog, unlock rules, and progress completion."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.content import Lesson, Unit
from app.models.gamification import LessonProgress
from app.models.user import User
from app.services import badges as badge_service
from app.services import tracks as track_service
from app.services import xp as xp_service

PASS_DEFAULT = 80.0
MASTER_SCORE = 90.0


def _require_track(db: Session, user: User, track: str) -> None:
    enrolled = track_service.list_tracks(db, user.id)
    if track not in enrolled and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Enroll in the {track} track first.",
        )


def _ordered_lessons(db: Session, track: str) -> list[tuple[Unit, Lesson]]:
    units = db.scalars(
        select(Unit)
        .where(Unit.track == track, Unit.is_published.is_(True))
        .options(selectinload(Unit.lessons))
        .order_by(Unit.order)
    ).all()
    rows: list[tuple[Unit, Lesson]] = []
    for unit in units:
        for lesson in sorted(unit.lessons, key=lambda item: item.order):
            if lesson.is_published:
                rows.append((unit, lesson))
    return rows


def _progress_map(db: Session, user_id: uuid.UUID) -> dict[int, LessonProgress]:
    rows = db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id)).all()
    return {row.lesson_id: row for row in rows}


def _is_passed(progress: LessonProgress | None, lesson: Lesson) -> bool:
    if progress is None or progress.status not in {"completed", "mastered"}:
        return False
    if lesson.type == "review":
        pass_score = float((lesson.content or {}).get("pass_score") or PASS_DEFAULT)
        return float(progress.best_score or 0) >= pass_score
    return True


def _unit_unlocked(
    unit: Unit,
    units: list[Unit],
    progress: dict[int, LessonProgress],
) -> bool:
    if unit.order <= 1:
        return True
    previous = next((item for item in units if item.order == unit.order - 1), None)
    if previous is None:
        return True
    review = next(
        (lesson for lesson in previous.lessons if lesson.is_published and lesson.type == "review"),
        None,
    )
    if review is not None:
        return _is_passed(progress.get(review.id), review)
    # No review lesson: require every published lesson completed.
    published = [lesson for lesson in previous.lessons if lesson.is_published]
    return all(_is_passed(progress.get(lesson.id), lesson) for lesson in published)


def _lesson_status(
    *,
    unit: Unit,
    lesson: Lesson,
    prior: Lesson | None,
    units: list[Unit],
    progress: dict[int, LessonProgress],
) -> str:
    row = progress.get(lesson.id)
    if row and row.status in {"completed", "mastered"}:
        return row.status
    if not _unit_unlocked(unit, units, progress):
        return "locked"
    if prior is None:
        return "available"
    if _is_passed(progress.get(prior.id), prior):
        return "available"
    return "locked"


def list_track_curriculum(db: Session, user: User, track: str) -> dict:
    _require_track(db, user, track)
    units = db.scalars(
        select(Unit)
        .where(Unit.track == track, Unit.is_published.is_(True))
        .options(selectinload(Unit.lessons))
        .order_by(Unit.order)
    ).all()
    progress = _progress_map(db, user.id)
    unit_payload = []
    next_lesson_id: int | None = None

    for unit in units:
        unit_open = _unit_unlocked(unit, list(units), progress)
        lessons_out = []
        prior: Lesson | None = None
        for lesson in sorted((item for item in unit.lessons if item.is_published), key=lambda x: x.order):
            status_name = _lesson_status(
                unit=unit,
                lesson=lesson,
                prior=prior,
                units=list(units),
                progress=progress,
            )
            row = progress.get(lesson.id)
            lessons_out.append(
                {
                    "id": lesson.id,
                    "order": lesson.order,
                    "title": lesson.title,
                    "type": lesson.type,
                    "xp_reward": lesson.xp_reward,
                    "status": status_name,
                    "best_score": row.best_score if row else None,
                    "attempts": row.attempts if row else 0,
                }
            )
            if next_lesson_id is None and status_name == "available":
                next_lesson_id = lesson.id
            prior = lesson
        unit_payload.append(
            {
                "id": unit.id,
                "order": unit.order,
                "title": unit.title,
                "description": unit.description,
                "unlocked": unit_open,
                "lessons": lessons_out,
            }
        )

    return {"track": track, "units": unit_payload, "next_lesson_id": next_lesson_id}


def get_lesson_for_user(db: Session, user: User, lesson_id: int) -> dict:
    lesson = db.scalar(
        select(Lesson)
        .where(Lesson.id == lesson_id, Lesson.is_published.is_(True))
        .options(selectinload(Lesson.unit))
    )
    if lesson is None or lesson.unit is None or not lesson.unit.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    track = lesson.unit.track
    _require_track(db, user, track)
    catalog = list_track_curriculum(db, user, track)
    status_name = "locked"
    for unit in catalog["units"]:
        for item in unit["lessons"]:
            if item["id"] == lesson_id:
                status_name = item["status"]
                break
    if status_name == "locked" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lesson is locked")

    progress = db.get(LessonProgress, (user.id, lesson_id))
    return {
        "id": lesson.id,
        "unit_id": lesson.unit_id,
        "unit_title": lesson.unit.title,
        "track": track,
        "order": lesson.order,
        "title": lesson.title,
        "type": lesson.type,
        "xp_reward": lesson.xp_reward,
        "content": lesson.content or {},
        "status": status_name,
        "best_score": progress.best_score if progress else None,
        "attempts": progress.attempts if progress else 0,
    }


def complete_lesson(
    db: Session,
    user: User,
    *,
    lesson_id: int,
    score: float,
    correct: int,
    total: int,
) -> dict:
    if total <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"total": "total must be positive"},
        )
    score = max(0.0, min(100.0, float(score)))
    lesson = db.scalar(
        select(Lesson)
        .where(Lesson.id == lesson_id, Lesson.is_published.is_(True))
        .options(selectinload(Lesson.unit))
    )
    if lesson is None or lesson.unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    detail = get_lesson_for_user(db, user, lesson_id)
    if detail["status"] == "locked" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lesson is locked")

    pass_score = PASS_DEFAULT
    if lesson.type == "review":
        pass_score = float((lesson.content or {}).get("pass_score") or PASS_DEFAULT)
    elif lesson.type in {"learn", "write", "read", "trace", "signature"}:
        pass_score = 60.0

    passed = score >= pass_score
    progress = db.get(LessonProgress, (user.id, lesson_id))
    first_pass = False
    if progress is None:
        progress = LessonProgress(
            user_id=user.id,
            lesson_id=lesson_id,
            status="available",
            best_score=None,
            attempts=0,
            completed_at=None,
        )
        db.add(progress)
        db.flush()

    progress.attempts = int(progress.attempts or 0) + 1
    previous_best = float(progress.best_score or 0)
    if progress.best_score is None or score > previous_best:
        progress.best_score = score

    xp_awarded = 0
    leveled = None
    new_badges: list = []
    if passed:
        if progress.status not in {"completed", "mastered"}:
            first_pass = True
            progress.completed_at = datetime.now(UTC)
        progress.status = "mastered" if score >= MASTER_SCORE else "completed"
        if first_pass:
            amount = max(1, round(lesson.xp_reward * (score / 100.0)))
            leveled = xp_service.award_xp(
                db,
                user_id=user.id,
                amount=amount,
                reason=f"lesson:{lesson.type}",
                ref_id=str(lesson.id),
                commit=False,
            )
            xp_awarded = amount
            if lesson.unit.track == "braille" and lesson.unit.order == 1 and lesson.order == 1:
                badge = badge_service.award_badge(
                    db, user_id=user.id, badge_key="first_dot", commit=False
                )
                if badge:
                    new_badges.append(badge)
            if lesson.unit.track == "cursive" and lesson.unit.order == 1 and lesson.order == 1:
                badge = badge_service.award_badge(
                    db, user_id=user.id, badge_key="first_loop", commit=False
                )
                if badge:
                    new_badges.append(badge)
            if lesson.type == "signature":
                badge = badge_service.award_badge(
                    db, user_id=user.id, badge_key="signed_it", commit=False
                )
                if badge:
                    new_badges.append(badge)
            new_badges.extend(badge_service.evaluate_badges(db, user.id))

    db.commit()
    db.refresh(progress)
    catalog = list_track_curriculum(db, user, lesson.unit.track)
    return {
        "lesson_id": lesson.id,
        "passed": passed,
        "pass_score": pass_score,
        "score": score,
        "correct": correct,
        "total": total,
        "status": progress.status,
        "best_score": progress.best_score,
        "attempts": progress.attempts,
        "xp_awarded": xp_awarded,
        "leveled_up": bool(leveled and leveled.leveled_up),
        "level": leveled.level if leveled else None,
        "new_badges": [
            {
                "key": b.key,
                "title": b.title,
                "description": b.description,
                "icon": b.icon,
                "earned_at": b.earned_at.isoformat(),
            }
            for b in new_badges
        ],
        "next_lesson_id": catalog["next_lesson_id"],
    }


def next_track_lesson_path(db: Session, user: User, track: str) -> str | None:
    if track not in track_service.list_tracks(db, user.id) and user.role != "admin":
        return None
    catalog = list_track_curriculum(db, user, track)
    lesson_id = catalog.get("next_lesson_id")
    if lesson_id is None:
        return f"/app/{track}"
    # Signature lessons open the studio directly when content says so.
    lesson = db.get(Lesson, lesson_id)
    if lesson and lesson.type == "signature":
        studio = (lesson.content or {}).get("studio_path")
        if isinstance(studio, str) and studio:
            return studio
    return f"/app/{track}/lessons/{lesson_id}"


def next_braille_lesson_path(db: Session, user: User) -> str | None:
    return next_track_lesson_path(db, user, "braille")


def next_cursive_lesson_path(db: Session, user: User) -> str | None:
    return next_track_lesson_path(db, user, "cursive")
