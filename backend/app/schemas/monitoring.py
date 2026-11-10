"""Monitoring and login-log schemas."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class LayoutSaveRequest(BaseModel):
    layout: list[dict[str, Any]] = Field(default_factory=list)


class LayoutResponse(BaseModel):
    layout: list[dict[str, Any]]


class LoginEventPublic(BaseModel):
    id: str
    user_id: str | None = None
    email_attempted: str
    success: bool
    ip: str | None = None
    device_summary: str | None = None
    created_at: str | None = None


class LoginSearchResponse(BaseModel):
    items: list[LoginEventPublic]
    page: int
    page_size: int
    total: int
    pages: int


class LoginEventCreateRequest(BaseModel):
    email_attempted: str = Field(min_length=1, max_length=320)
    success: bool = False
    ip: str | None = Field(default=None, max_length=64)
    device_summary: str | None = Field(default=None, max_length=255)
    user_id: uuid.UUID | None = None


class LoginEventUpdateRequest(BaseModel):
    email_attempted: str | None = Field(default=None, min_length=1, max_length=320)
    success: bool | None = None
    ip: str | None = Field(default=None, max_length=64)
    device_summary: str | None = Field(default=None, max_length=255)
    clear_ip: bool = False
    clear_device_summary: bool = False


class LoginEventPurgeRequest(BaseModel):
    success: Literal["all", "success", "fail"] = "fail"
    older_than_days: int | None = Field(default=None, ge=0, le=3650)
    user_id: uuid.UUID | None = None


class LoginEventPurgeResponse(BaseModel):
    deleted: int
