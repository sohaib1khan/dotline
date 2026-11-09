"""Seed published units/lessons from YAML content files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.content import Lesson, Unit

PACKAGED_CONTENT_ROOT = Path(__file__).resolve().parent.parent / "content"


def data_content_root() -> Path:
    return Path(get_settings().content_data_dir)


def content_root() -> Path:
    """Prefer writable data overlay when it has content; else packaged YAML."""
    data = data_content_root()
    if data.is_dir() and any(data.rglob("*.yaml")):
        return data
    return PACKAGED_CONTENT_ROOT


# Back-compat alias used across the codebase
CONTENT_ROOT = PACKAGED_CONTENT_ROOT


def resolve_content_file(*parts: str) -> Path:
    """Return data overlay path if the file exists, otherwise packaged path."""
    relative = Path(*parts)
    data_path = data_content_root() / relative
    if data_path.is_file():
        return data_path
    return PACKAGED_CONTENT_ROOT / relative


def resolve_track_dir(track: str) -> Path:
    data_dir = data_content_root() / track
    if data_dir.is_dir() and (
        (data_dir / "course.yaml").is_file() or list(data_dir.glob("unit_*.yaml"))
    ):
        return data_dir
    return PACKAGED_CONTENT_ROOT / track


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping in {path}")
    return data


def dump_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(data, handle, sort_keys=False, allow_unicode=True)


def _unit_dicts_from_track_dir(directory: Path) -> list[dict[str, Any]]:
    """Prefer course.yaml (all units); else legacy unit_*.yaml files."""
    course_path = directory / "course.yaml"
    if course_path.is_file():
        data = _load_yaml(course_path)
        units = data.get("units")
        if not isinstance(units, list):
            raise ValueError(f"{course_path} needs a units list")
        return [unit for unit in units if isinstance(unit, dict)]

    files = sorted(directory.glob("unit_*.yaml"))
    return [_load_yaml(path) for path in files]


def seed_track_units(db: Session, track: str, track_dir: Path | None = None) -> dict[str, int]:
    """Upsert units/lessons from course.yaml or unit_*.yaml for a track."""
    directory = track_dir or resolve_track_dir(track)
    unit_dicts = _unit_dicts_from_track_dir(directory)
    units_upserted = 0
    lessons_upserted = 0
    seen_unit_orders: set[int] = set()

    for data in unit_dicts:
        order = int(data["order"])
        seen_unit_orders.add(order)
        unit = db.scalar(select(Unit).where(Unit.track == track, Unit.order == order))
        if unit is None:
            unit = Unit(
                track=track,
                order=order,
                title=str(data["title"]),
                description=str(data.get("description") or ""),
                is_published=bool(data.get("is_published", True)),
            )
            db.add(unit)
            db.flush()
        else:
            unit.title = str(data["title"])
            unit.description = str(data.get("description") or "")
            unit.is_published = bool(data.get("is_published", True))
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
                "is_published": bool(lesson_data.get("is_published", True)),
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

    # When seeding from a full course.yaml, drop units removed from the file.
    if (directory / "course.yaml").is_file() and seen_unit_orders:
        for unit in db.scalars(select(Unit).where(Unit.track == track)).all():
            if unit.order not in seen_unit_orders:
                db.delete(unit)

    db.commit()
    return {"units": units_upserted, "lessons": lessons_upserted}


def seed_braille_units(db: Session) -> dict[str, int]:
    return seed_track_units(db, "braille")


def seed_cursive_units(db: Session) -> dict[str, int]:
    return seed_track_units(db, "cursive")


def load_cursive_strokes() -> dict[str, Any]:
    return _load_yaml(resolve_content_file("cursive", "strokes.yaml"))


def load_braille_alphabet() -> dict[str, Any]:
    return _load_yaml(resolve_content_file("braille", "alphabet.yaml"))


def seed_all_content(db: Session) -> dict[str, int]:
    """Seed packaged YAML, then overlay data/content so new units always land."""
    totals = {"units": 0, "lessons": 0}
    for track in ("braille", "cursive"):
        packaged = seed_track_units(db, track, PACKAGED_CONTENT_ROOT / track)
        totals["units"] += packaged["units"]
        totals["lessons"] += packaged["lessons"]
        data_dir = data_content_root() / track
        has_overlay = data_dir.is_dir() and (
            (data_dir / "course.yaml").is_file() or list(data_dir.glob("unit_*.yaml"))
        )
        if has_overlay:
            overlay = seed_track_units(db, track, data_dir)
            totals["units"] = max(totals["units"], overlay["units"])
            totals["lessons"] = max(totals["lessons"], overlay["lessons"])
    return totals
