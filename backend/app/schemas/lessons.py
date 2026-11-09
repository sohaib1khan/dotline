"""Lesson catalog and completion schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LessonSummary(BaseModel):
    id: int
    order: int
    title: str
    type: str
    xp_reward: int
    status: str
    best_score: float | None = None
    attempts: int = 0


class UnitSummary(BaseModel):
    id: int
    order: int
    title: str
    description: str
    unlocked: bool
    lessons: list[LessonSummary]


class TrackCurriculumResponse(BaseModel):
    track: str
    units: list[UnitSummary]
    next_lesson_id: int | None = None


class LessonDetailResponse(BaseModel):
    id: int
    unit_id: int
    unit_title: str
    track: str
    order: int
    title: str
    type: str
    xp_reward: int
    content: dict[str, Any]
    status: str
    best_score: float | None = None
    attempts: int = 0


class LessonCompleteRequest(BaseModel):
    score: float = Field(ge=0, le=100)
    correct: int = Field(ge=0)
    total: int = Field(ge=1)


class LessonCompleteResponse(BaseModel):
    lesson_id: int
    passed: bool
    pass_score: float
    score: float
    correct: int
    total: int
    status: str
    best_score: float | None
    attempts: int
    xp_awarded: int
    leveled_up: bool
    level: int | None = None
    new_badges: list[dict[str, Any]]
    next_lesson_id: int | None = None
