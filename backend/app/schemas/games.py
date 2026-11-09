"""Game API schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GameInfo(BaseModel):
    key: str
    title: str
    track: str
    description: str
    duration_s: int
    unlocked: bool
    lock_reason: str | None = None
    high_score: int
    difficulty: int


class GamesListResponse(BaseModel):
    games: list[GameInfo]


class GameScoreRequest(BaseModel):
    score: int = Field(ge=0, le=100000)
    accuracy: float | None = Field(default=None, ge=0, le=100)
    duration_s: int | None = Field(default=None, ge=1, le=600)


class GameScoreResponse(BaseModel):
    ok: bool = True
    game_key: str
    score: int
    accuracy: float | None
    duration_s: int | None
    xp_awarded: int
    leveled_up: bool
    level: int | None = None
    high_score: int
    new_badges: list[dict[str, Any]]
