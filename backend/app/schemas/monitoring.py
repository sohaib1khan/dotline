"""Monitoring and login-log schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LayoutSaveRequest(BaseModel):
    layout: list[dict[str, Any]] = Field(default_factory=list)


class LayoutResponse(BaseModel):
    layout: list[dict[str, Any]]


class LoginSearchResponse(BaseModel):
    items: list[dict[str, Any]]
    page: int
    page_size: int
    total: int
    pages: int
