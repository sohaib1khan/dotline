"""Full course pack export/import (ZIP of YAML).

Pack layout (v2 — one course file per track):
  dotline-course/
    manifest.yaml
    braille/
      alphabet.yaml
      course.yaml      # all braille units + lessons
    cursive/
      strokes.yaml
      course.yaml      # all cursive units + lessons

Legacy v1 packs with braille/unit_*.yaml and cursive/unit_*.yaml still import.
"""

from __future__ import annotations

import io
import zipfile
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Any

import yaml
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.content import Unit
from app.services import content_seed


PACK_VERSION = 2
REQUIRED_LIBRARIES = (
    ("braille", "alphabet.yaml"),
    ("cursive", "strokes.yaml"),
)


def _yaml_bytes(data: dict[str, Any]) -> bytes:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True).encode("utf-8")


def _unit_payload(unit: Unit) -> dict[str, Any]:
    lessons = sorted(unit.lessons, key=lambda lesson: lesson.order)
    return {
        "order": unit.order,
        "title": unit.title,
        "description": unit.description or "",
        "is_published": unit.is_published,
        "lessons": [
            {
                "order": lesson.order,
                "title": lesson.title,
                "type": lesson.type,
                "xp_reward": lesson.xp_reward,
                "is_published": lesson.is_published,
                "content": lesson.content or {},
            }
            for lesson in lessons
        ],
    }


def _course_payload(track: str, units: list[Unit]) -> dict[str, Any]:
    return {
        "track": track,
        "title": "Braille" if track == "braille" else "Cursive",
        "units": [_unit_payload(unit) for unit in units],
    }


def export_course_zip(db: Session) -> bytes:
    """Build a ZIP with alphabet/strokes + one course.yaml per track."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        braille_units = db.scalars(
            select(Unit)
            .where(Unit.track == "braille")
            .options(selectinload(Unit.lessons))
            .order_by(Unit.order)
        ).all()
        cursive_units = db.scalars(
            select(Unit)
            .where(Unit.track == "cursive")
            .options(selectinload(Unit.lessons))
            .order_by(Unit.order)
        ).all()

        alphabet = content_seed.load_braille_alphabet()
        strokes = content_seed.load_cursive_strokes()
        archive.writestr("dotline-course/braille/alphabet.yaml", _yaml_bytes(alphabet))
        archive.writestr("dotline-course/cursive/strokes.yaml", _yaml_bytes(strokes))
        archive.writestr(
            "dotline-course/braille/course.yaml",
            _yaml_bytes(_course_payload("braille", list(braille_units))),
        )
        archive.writestr(
            "dotline-course/cursive/course.yaml",
            _yaml_bytes(_course_payload("cursive", list(cursive_units))),
        )

        manifest = {
            "version": PACK_VERSION,
            "format": "single-course-file-per-track",
            "exported_at": datetime.now(UTC).isoformat(),
            "braille_units": len(braille_units),
            "cursive_units": len(cursive_units),
            "braille_lessons": sum(len(unit.lessons) for unit in braille_units),
            "cursive_lessons": sum(len(unit.lessons) for unit in cursive_units),
            "edit": (
                "Edit braille/course.yaml and cursive/course.yaml only — "
                "each file holds every unit and lesson for that track."
            ),
        }
        archive.writestr("dotline-course/manifest.yaml", _yaml_bytes(manifest))

    return buffer.getvalue()


def _normalize_member_name(name: str) -> str | None:
    path = PurePosixPath(name)
    parts = [part for part in path.parts if part not in {"", "."}]
    if ".." in parts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ZIP paths must not contain '..'.",
        )
    if not parts:
        return None
    if parts[0] == "dotline-course":
        parts = parts[1:]
    if not parts:
        return None
    return "/".join(parts)


def _read_pack_files(raw: bytes) -> dict[str, bytes]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is not a valid ZIP. Download a Dotline course pack and try again.",
        ) from exc

    files: dict[str, bytes] = {}
    with archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            normalized = _normalize_member_name(info.filename)
            if normalized is None or not normalized.endswith((".yaml", ".yml")):
                continue
            files[normalized] = archive.read(info)
    return files


def _parse_yaml_bytes(payload: bytes, label: str) -> dict[str, Any]:
    try:
        data = yaml.safe_load(payload.decode("utf-8"))
    except (UnicodeDecodeError, yaml.YAMLError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse {label}: {exc}",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} must be a YAML mapping.",
        )
    return data


def _validate_unit_dict(data: dict[str, Any], label: str) -> None:
    if "order" not in data or "title" not in data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} needs order and title fields.",
        )
    if not isinstance(data.get("lessons"), list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} needs a lessons list.",
        )


def _validate_course_dict(data: dict[str, Any], label: str, expected_track: str) -> list[dict[str, Any]]:
    units = data.get("units")
    if not isinstance(units, list) or not units:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} needs a non-empty units list.",
        )
    track = str(data.get("track") or expected_track).strip().lower()
    if track != expected_track:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} track must be '{expected_track}' (got '{track}').",
        )
    for index, unit in enumerate(units):
        if not isinstance(unit, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{label} units[{index}] must be a mapping.",
            )
        _validate_unit_dict(unit, f"{label} units[{index}]")
    return units


def _legacy_unit_keys(files: dict[str, bytes], track: str) -> list[str]:
    return sorted(
        key
        for key in files
        if key.startswith(f"{track}/unit_") and key.endswith((".yaml", ".yml"))
    )


def import_course_zip(db: Session, raw: bytes) -> dict[str, Any]:
    """Validate ZIP, write libraries + course files to data overlay, seed DB."""
    files = _read_pack_files(raw)
    for track, name in REQUIRED_LIBRARIES:
        key = f"{track}/{name}"
        if key not in files:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"ZIP must include {key}. Expected folders braille/ and cursive/.",
            )

    # Prefer one course.yaml per track; fall back to legacy unit_*.yaml.
    track_units: dict[str, list[dict[str, Any]]] = {}
    parsed_libs: dict[str, dict[str, Any]] = {}

    for track in ("braille", "cursive"):
        course_key = f"{track}/course.yaml"
        if course_key in files:
            course_data = _parse_yaml_bytes(files[course_key], course_key)
            track_units[track] = _validate_course_dict(course_data, course_key, track)
            continue

        legacy_keys = _legacy_unit_keys(files, track)
        if not legacy_keys:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"ZIP must include {track}/course.yaml "
                    f"(or legacy {track}/unit_*.yaml files)."
                ),
            )
        units: list[dict[str, Any]] = []
        for key in legacy_keys:
            data = _parse_yaml_bytes(files[key], key)
            _validate_unit_dict(data, key)
            units.append(data)
        track_units[track] = units

    for track, name in REQUIRED_LIBRARIES:
        key = f"{track}/{name}"
        parsed_libs[key] = _parse_yaml_bytes(files[key], key)

    manifest_data: dict[str, Any] | None = None
    if "manifest.yaml" in files:
        manifest_data = _parse_yaml_bytes(files["manifest.yaml"], "manifest.yaml")

    data_root = content_seed.data_content_root()
    data_root.mkdir(parents=True, exist_ok=True)

    # Clear previous overlay track folders then write pack
    for track in ("braille", "cursive"):
        track_dir = data_root / track
        if track_dir.exists():
            for path in track_dir.glob("*"):
                if path.is_file():
                    path.unlink()
        track_dir.mkdir(parents=True, exist_ok=True)

    for key, data in parsed_libs.items():
        content_seed.dump_yaml(data_root / key, data)

    if manifest_data is not None:
        content_seed.dump_yaml(data_root / "manifest.yaml", manifest_data)

    files_written = len(parsed_libs) + (1 if manifest_data is not None else 0)
    for track, units in track_units.items():
        course_payload = {
            "track": track,
            "title": "Braille" if track == "braille" else "Cursive",
            "units": units,
        }
        content_seed.dump_yaml(data_root / track / "course.yaml", course_payload)
        files_written += 1

    braille = content_seed.seed_track_units(db, "braille", track_dir=data_root / "braille")
    cursive = content_seed.seed_track_units(db, "cursive", track_dir=data_root / "cursive")
    return {
        "ok": True,
        "braille_units": braille["units"],
        "braille_lessons": braille["lessons"],
        "cursive_units": cursive["units"],
        "cursive_lessons": cursive["lessons"],
        "files_written": files_written,
        "format": "course.yaml",
    }
