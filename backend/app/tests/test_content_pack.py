"""Course pack v2 uses one course.yaml per track."""

from __future__ import annotations

import io
import zipfile
from types import SimpleNamespace

import yaml

from app.services import content_pack


def test_course_payload_shape() -> None:
    lesson = SimpleNamespace(
        order=1,
        title="Dot 1",
        type="learn",
        xp_reward=10,
        is_published=True,
        content={"instruction": "Press F"},
    )
    unit = SimpleNamespace(
        order=1,
        title="Meet the Cell",
        description="Intro",
        is_published=True,
        lessons=[lesson],
    )
    payload = content_pack._course_payload("braille", [unit])  # noqa: SLF001
    assert payload["track"] == "braille"
    assert payload["units"][0]["title"] == "Meet the Cell"
    assert payload["units"][0]["lessons"][0]["title"] == "Dot 1"


def test_import_accepts_single_course_files(tmp_path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.services import content_seed

    monkeypatch.setattr(content_seed, "data_content_root", lambda: tmp_path)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w") as archive:
        archive.writestr(
            "dotline-course/braille/alphabet.yaml",
            yaml.safe_dump({"letters": {"a": [1]}}),
        )
        archive.writestr(
            "dotline-course/cursive/strokes.yaml",
            yaml.safe_dump({"letters": {}, "warmups": {}}),
        )
        archive.writestr(
            "dotline-course/braille/course.yaml",
            yaml.safe_dump(
                {
                    "track": "braille",
                    "units": [
                        {
                            "order": 1,
                            "title": "Unit A",
                            "lessons": [
                                {
                                    "order": 1,
                                    "title": "L1",
                                    "type": "learn",
                                    "xp_reward": 10,
                                    "content": {"items": []},
                                }
                            ],
                        }
                    ],
                }
            ),
        )
        archive.writestr(
            "dotline-course/cursive/course.yaml",
            yaml.safe_dump(
                {
                    "track": "cursive",
                    "units": [
                        {
                            "order": 1,
                            "title": "Unit C",
                            "lessons": [
                                {
                                    "order": 1,
                                    "title": "Warmup",
                                    "type": "practice",
                                    "xp_reward": 10,
                                    "content": {"items": []},
                                }
                            ],
                        }
                    ],
                }
            ),
        )

    calls: list[tuple[str, object]] = []

    def fake_seed(db, track, track_dir=None):  # type: ignore[no-untyped-def]
        calls.append((track, track_dir))
        return {"units": 1, "lessons": 1}

    monkeypatch.setattr(content_seed, "seed_track_units", fake_seed)

    result = content_pack.import_course_zip(db=None, raw=buffer.getvalue())  # type: ignore[arg-type]
    assert result["ok"] is True
    assert (tmp_path / "braille" / "course.yaml").is_file()
    assert (tmp_path / "cursive" / "course.yaml").is_file()
    assert not list((tmp_path / "braille").glob("unit_*.yaml"))
    braille = yaml.safe_load((tmp_path / "braille" / "course.yaml").read_text(encoding="utf-8"))
    assert len(braille["units"]) == 1
    assert {track for track, _ in calls} == {"braille", "cursive"}
