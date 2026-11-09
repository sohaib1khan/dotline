"""Smoke tests for braille YAML content shape."""

from pathlib import Path

import yaml

CONTENT = Path(__file__).resolve().parents[1] / "content"
BRAILLE = CONTENT / "braille"
CURSIVE = CONTENT / "cursive"


def test_all_unit_files_present() -> None:
    assert len(sorted(BRAILLE.glob("unit_*.yaml"))) == 8
    assert len(sorted(CURSIVE.glob("unit_*.yaml"))) == 6
    assert (CURSIVE / "strokes.yaml").is_file()


def test_unit_orders_unique_and_complete() -> None:
    orders = []
    for path in sorted(BRAILLE.glob("unit_*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        orders.append(data["order"])
        assert data["title"]
        assert data["lessons"]
        types = {lesson["type"] for lesson in data["lessons"]}
        assert types <= {"learn", "write", "read", "review"}
        assert "review" in types
    assert sorted(orders) == list(range(1, 9))


def test_cursive_stroke_library_complete() -> None:
    data = yaml.safe_load((CURSIVE / "strokes.yaml").read_text(encoding="utf-8"))
    letters = data["letters"]
    assert len(letters) == 52
    assert "a" in letters and "Z" in letters
    assert "undercurve" in data["warmups"]
