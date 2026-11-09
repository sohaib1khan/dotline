"""Announcement schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=8000)


class AnnouncementResponse(BaseModel):
    ok: bool = True
    delivered: int
    title: str
    message: str
