"""Unit tests for XP level math and awards."""

from app.services.xp import level_progress, xp_to_advance


def test_xp_to_advance_formula() -> None:
    assert xp_to_advance(1) == 100
    assert xp_to_advance(2) == round(100 * (2**1.5))
    assert xp_to_advance(3) == round(100 * (3**1.5))


def test_level_progress_starts_at_one() -> None:
    level, into, need = level_progress(0)
    assert level == 1
    assert into == 0
    assert need == 100


def test_level_progress_levels_up() -> None:
    level, into, need = level_progress(100)
    assert level == 2
    assert into == 0
    assert need == round(100 * (2**1.5))


def test_level_progress_partial() -> None:
    level, into, need = level_progress(40)
    assert level == 1
    assert into == 40
    assert need == 100
