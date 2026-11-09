"""Seed published units/lessons from YAML content files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.content import Lesson, Unit

CONTENT_ROOT = Path(__file__).resolve().parent.parent / "content"
BRAILLE_DIR = CONTENT_ROOT / "braille"


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping in {path}")
    return data


def seed_braille_units(db: Session) -> dict[str, int]:
    """Upsert all braille unit YAML files. Returns counts."""
    files = sorted(BRAILLE_DIR.glob("unit_*.yaml"))
    units_upserted = 0
    lessons_upserted = 0

    for path in files:
        data = _load_yaml(path)
        order = int(data["order"])
        unit = db.scalar(select(Unit).where(Unit.track == "braille", Unit.order == order))
        if unit is None:
            unit = Unit(
                track="braille",
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

        # Remove stale lesson rows for this unit that are no longer in YAML.
        existing = db.scalars(select(Lesson).where(Lesson.unit_id == unit.id)).all()
        for lesson in existing:
            if lesson.order not in seen_orders:
                db.delete(lesson)

    db.commit()
    return {"units": units_upserted, "lessons": lessons_upserted}


def seed_all_content(db: Session) -> dict[str, int]:
    return seed_braille_units(db)
