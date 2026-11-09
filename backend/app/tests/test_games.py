"""Unit tests for game difficulty helpers."""

from app.services.games import GAME_CATALOG


def test_four_games_two_per_track() -> None:
    assert len(GAME_CATALOG) == 4
    braille = [game for game in GAME_CATALOG if game["track"] == "braille"]
    cursive = [game for game in GAME_CATALOG if game["track"] == "cursive"]
    assert len(braille) == 2
    assert len(cursive) == 2
