"""Seed published units/lessons from YAML content files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.content import Lesson, Unit

CONTENT_ROOT = Path(__file__).resolve().parent.parent / "content"


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping in {path}")
    return data


def seed_track_units(db: Session, track: str) -> dict[str, int]:
    """Upsert all unit_*.yaml files for a track."""
    track_dir = CONTENT_ROOT / track
    files = sorted(track_dir.glob("unit_*.yaml"))
    units_upserted = 0
    lessons_upserted = 0

    for path in files:
        data = _load_yaml(path)
        order = int(data["order"])
        unit = db.scalar(select(Unit).where(Unit.track == track, Unit.order == order))
        if unit is None:
            unit = Unit(
                track=track,
                order=order,
                title=str(data["title"]),
                description=str(data.get("description") or ""),
                is_published=True,
            )
            db.add(unit)
            db.flush()
        else:
            unit.title = str(data["title"])
            unit.description = str(data.get("description") or "")
            unit.is_published = True
        units_upserted += 1

        seen_orders: set[int] = set()
        for lesson_data in data.get("lessons") or []:
            lesson_order = int(lesson_data["order"])
            seen_orders.add(lesson_order)
            lesson = db.scalar(
                select(Lesson).where(Lesson.unit_id == unit.id, Lesson.order == lesson_order)
            )
            payload = {
                "title": str(lesson_data["title"]),
                "type": str(lesson_data["type"]),
                "content": lesson_data.get("content") or {},
                "xp_reward": int(lesson_data.get("xp_reward") or 10),
                "is_published": True,
            }
            if lesson is None:
                lesson = Lesson(unit_id=unit.id, order=lesson_order, **payload)
                db.add(lesson)
            else:
                for key, value in payload.items():
                    setattr(lesson, key, value)
            lessons_upserted += 1

        existing = db.scalars(select(Lesson).where(Lesson.unit_id == unit.id)).all()
        for lesson in existing:
            if lesson.order not in seen_orders:
                db.delete(lesson)

    db.commit()
    return {"units": units_upserted, "lessons": lessons_upserted}


def seed_braille_units(db: Session) -> dict[str, int]:
    return seed_track_units(db, "braille")


def seed_cursive_units(db: Session) -> dict[str, int]:
    return seed_track_units(db, "cursive")


def load_cursive_strokes() -> dict[str, Any]:
    path = CONTENT_ROOT / "cursive" / "strokes.yaml"
    return _load_yaml(path)


def seed_all_content(db: Session) -> dict[str, int]:
    braille = seed_braille_units(db)
    cursive = seed_cursive_units(db)
    return {
        "units": braille["units"] + cursive["units"],
        "lessons": braille["lessons"] + cursive["lessons"],
    }
