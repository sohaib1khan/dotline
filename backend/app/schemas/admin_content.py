"""Admin CMS schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class LessonAdmin(BaseModel):
    id: int
    unit_id: int
    order: int
    title: str
    type: str
    content: dict[str, Any]
    xp_reward: int
    is_published: bool


class UnitAdmin(BaseModel):
    id: int
    track: str
    order: int
    title: str
    description: str
    is_published: bool
    lessons: list[LessonAdmin] = Field(default_factory=list)


class UnitUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_published: bool | None = None
    order: int | None = Field(default=None, ge=1, le=1000)


class LessonCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=32)
    content: dict[str, Any] = Field(default_factory=dict)
    xp_reward: int = Field(default=10, ge=0, le=1000)
    is_published: bool = False


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = Field(default=None, min_length=1, max_length=32)
    content: dict[str, Any] | None = None
    xp_reward: int | None = Field(default=None, ge=0, le=1000)
    is_published: bool | None = None
    order: int | None = Field(default=None, ge=1, le=1000)


class MoveRequest(BaseModel):
    direction: Literal["up", "down"]


class ReseedRequest(BaseModel):
    track: Literal["braille", "cursive", "all"] = "all"
    confirm: str = Field(min_length=5, max_length=32)


class ImportConfirmRequest(BaseModel):
    confirm: str = Field(min_length=5, max_length=32)


class ImportResult(BaseModel):
    message: str
    braille_units: int
    braille_lessons: int
    cursive_units: int
    cursive_lessons: int
    files_written: int
