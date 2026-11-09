"""Bug report schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

BugCategory = Literal[
    "sound_not_working",
    "vibration_not_working",
    "controller_problem",
    "hard_to_see_read",
    "lesson_stuck_or_wrong",
    "tracing_not_scoring",
    "login_or_account",
    "layout_broken",
    "other",
]


class BugCreateRequest(BaseModel):
    category: BugCategory
    description: str = Field(default="", max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)


class BugPublic(BaseModel):
    id: str
    category: str
    category_label: str
    description: str
    status: str
    admin_note: str | None = None
    created_at: str
    updated_at: str
    user_id: str | None = None
    context: dict[str, Any] | None = None


class BugReplyRequest(BaseModel):
    reply: str = Field(min_length=2, max_length=4000)
    status: Literal["open", "in_progress", "fixed", "wont_fix"] | None = None
