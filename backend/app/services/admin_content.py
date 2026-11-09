"""Admin CMS for units and lessons."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.content import Lesson, Unit
from app.services import content_seed


def _unit_public(unit: Unit, *, include_lessons: bool = True) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": unit.id,
        "track": unit.track,
        "order": unit.order,
        "title": unit.title,
        "description": unit.description,
        "is_published": unit.is_published,
    }
    if include_lessons:
        lessons = sorted(unit.lessons, key=lambda row: row.order)
        payload["lessons"] = [_lesson_public(lesson) for lesson in lessons]
    return payload


def lesson_public(lesson: Lesson) -> dict[str, Any]:
    return {
        "id": lesson.id,
        "unit_id": lesson.unit_id,
        "order": lesson.order,
        "title": lesson.title,
        "type": lesson.type,
        "content": lesson.content or {},
        "xp_reward": lesson.xp_reward,
        "is_published": lesson.is_published,
    }


def _lesson_public(lesson: Lesson) -> dict[str, Any]:
    return lesson_public(lesson)


def list_units(db: Session, track: str) -> list[dict[str, Any]]:
    if track not in {"braille", "cursive"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid track")
    rows = db.scalars(
        select(Unit)
        .options(selectinload(Unit.lessons))
        .where(Unit.track == track)
        .order_by(Unit.order.asc())
    ).all()
    return [_unit_public(row) for row in rows]


def get_unit(db: Session, unit_id: int) -> Unit:
    unit = db.scalar(
        select(Unit).options(selectinload(Unit.lessons)).where(Unit.id == unit_id)
    )
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    return unit


def get_lesson(db: Session, lesson_id: int) -> Lesson:
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return lesson


def update_unit(
    db: Session,
    unit_id: int,
    *,
    title: str | None = None,
    description: str | None = None,
    is_published: bool | None = None,
    order: int | None = None,
) -> dict[str, Any]:
    unit = get_unit(db, unit_id)
    if title is not None:
        unit.title = title.strip()[:200]
    if description is not None:
        unit.description = description.strip()
    if is_published is not None:
        unit.is_published = is_published
    if order is not None:
        unit.order = order
    db.commit()
    return _unit_public(get_unit(db, unit_id))


def create_lesson(
    db: Session,
    *,
    unit_id: int,
    title: str,
    type_value: str,
    content: dict[str, Any] | None = None,
    xp_reward: int = 10,
    is_published: bool = False,
) -> dict[str, Any]:
    unit = get_unit(db, unit_id)
    max_order = max((lesson.order for lesson in unit.lessons), default=0)
    lesson = Lesson(
        unit_id=unit.id,
        order=max_order + 1,
        title=title.strip()[:200],
        type=type_value.strip()[:32],
        content=content or {},
        xp_reward=max(0, xp_reward),
        is_published=is_published,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return _lesson_public(lesson)


def update_lesson(
    db: Session,
    lesson_id: int,
    *,
    title: str | None = None,
    type_value: str | None = None,
    content: dict[str, Any] | None = None,
    xp_reward: int | None = None,
    is_published: bool | None = None,
    order: int | None = None,
) -> dict[str, Any]:
    lesson = get_lesson(db, lesson_id)
    if title is not None:
        lesson.title = title.strip()[:200]
    if type_value is not None:
        lesson.type = type_value.strip()[:32]
    if content is not None:
        lesson.content = content
    if xp_reward is not None:
        lesson.xp_reward = max(0, xp_reward)
    if is_published is not None:
        lesson.is_published = is_published
    if order is not None:
        lesson.order = order
    db.commit()
    db.refresh(lesson)
    return _lesson_public(lesson)


def delete_lesson(db: Session, lesson_id: int) -> dict[str, str]:
    lesson = get_lesson(db, lesson_id)
    db.delete(lesson)
    db.commit()
    return {"message": "Lesson deleted."}


def move_lesson(db: Session, lesson_id: int, *, direction: str) -> dict[str, Any]:
    if direction not in {"up", "down"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid direction")
    lesson = get_lesson(db, lesson_id)
    siblings = list(
        db.scalars(
            select(Lesson).where(Lesson.unit_id == lesson.unit_id).order_by(Lesson.order.asc())
        ).all()
    )
    index = next((i for i, row in enumerate(siblings) if row.id == lesson.id), None)
    if index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    swap_with = index - 1 if direction == "up" else index + 1
    if swap_with < 0 or swap_with >= len(siblings):
        return _lesson_public(lesson)
    other = siblings[swap_with]
    lesson.order, other.order = other.order, lesson.order
    db.commit()
    db.refresh(lesson)
    return _lesson_public(lesson)


def move_unit(db: Session, unit_id: int, *, direction: str) -> dict[str, Any]:
    if direction not in {"up", "down"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid direction")
    unit = get_unit(db, unit_id)
    siblings = list(
        db.scalars(select(Unit).where(Unit.track == unit.track).order_by(Unit.order.asc())).all()
    )
    index = next((i for i, row in enumerate(siblings) if row.id == unit.id), None)
    if index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    swap_with = index - 1 if direction == "up" else index + 1
    if swap_with < 0 or swap_with >= len(siblings):
        return _unit_public(get_unit(db, unit_id))
    other = siblings[swap_with]
    unit.order, other.order = other.order, unit.order
    db.commit()
    return _unit_public(get_unit(db, unit_id))


def reseed_from_yaml(db: Session, track: str | None = None) -> dict[str, Any]:
    if track is None:
        result = content_seed.seed_all_content(db)
        return {"ok": True, "track": "all", **result}
    if track not in {"braille", "cursive"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid track")
    result = content_seed.seed_track_units(db, track)
    return {"ok": True, "track": track, **result}


def stroke_library_keys() -> dict[str, list[str]]:
    data = content_seed.load_cursive_strokes()
    warmups = sorted((data.get("warmups") or {}).keys())
    letters = sorted((data.get("letters") or {}).keys())
    return {"warmups": warmups, "letters": letters}


def braille_alphabet() -> dict[str, Any]:
    path = content_seed.CONTENT_ROOT / "braille" / "alphabet.yaml"
    return content_seed._load_yaml(path)
