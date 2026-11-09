"""Smoke tests for braille YAML content shape."""

from pathlib import Path

import yaml

BRAILLE = Path(__file__).resolve().parents[1] / "content" / "braille"


def test_all_unit_files_present() -> None:
    files = sorted(BRAILLE.glob("unit_*.yaml"))
    assert len(files) == 8


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
