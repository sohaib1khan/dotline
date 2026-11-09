"""Admin user management schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AdminUserSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    username: str
    email: str
    role: str
    is_active: bool
    email_verified_at: str | None
    created_at: str | None
    last_login_at: str | None


class AdminUserDetail(AdminUserSummary):
    tracks: list[str]
    progress: dict[str, Any]
    total_active_seconds: int
    login_history: list[dict[str, Any]]
    bug_reports: list[dict[str, Any]]


class SetActiveRequest(BaseModel):
    is_active: bool


class SetRoleRequest(BaseModel):
    role: Literal["admin", "learner"]


class AdminResetProgressRequest(BaseModel):
    scope: Literal["braille", "cursive", "everything"]
    confirm: str = Field(min_length=5, max_length=16)


class DeleteUserRequest(BaseModel):
    confirm_username: str = Field(min_length=1, max_length=24)


class MessageOnly(BaseModel):
    message: str
