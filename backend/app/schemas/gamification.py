"""Gamification and statusboard API schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TracksResponse(BaseModel):
    tracks: list[str]


class TracksUpdateRequest(BaseModel):
    tracks: list[str] = Field(min_length=1, max_length=2)


class BadgePublic(BaseModel):
    key: str
    title: str
    description: str
    icon: str
    earned_at: datetime | str


class ContinueTarget(BaseModel):
    track: str
    label: str
    path: str
    hint: str


class StatusboardResponse(BaseModel):
    first_name: str
    tracks: list[str]
    level: int
    total_xp: int
    xp_into_level: int
    xp_for_next: int
    xp_progress_ratio: float
    streak_current: int
    streak_longest: int
    daily_goal_minutes: int
    today_active_seconds: int
    daily_goal_ratio: float
    unread_inbox: int
    latest_badges: list[BadgePublic]
    continue_targets: list[ContinueTarget]


class GrantXpRequest(BaseModel):
    amount: int = Field(ge=1, le=5000)
    reason: str = Field(default="admin_grant", min_length=1, max_length=128)
    user_id: str | None = None


class GrantXpResponse(BaseModel):
    ok: bool = True
    amount: int
    reason: str
    total_xp: int
    previous_level: int
    level: int
    xp_into_level: int
    xp_for_next: int
    leveled_up: bool
    levels_gained: int
    new_badges: list[BadgePublic]


class StreakPublic(BaseModel):
    current: int
    longest: int
    last_active_date: date | None
