"""Progress and reset schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProgressResponse(BaseModel):
    total_xp: int
    level: int
    xp_into_level: int
    xp_for_next: int
    badges_earned: int
    total_active_seconds: int
    game_high_scores: list[dict[str, Any]]
    tracks: dict[str, Any]


class ResetProgressRequest(BaseModel):
    scope: Literal["braille", "cursive", "everything"]
    confirm: str = Field(min_length=5, max_length=16)


class ResetProgressResponse(BaseModel):
    ok: bool = True
    scope: str
    removed: dict[str, int]
    progress: ProgressResponse
