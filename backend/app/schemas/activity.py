"""Activity heartbeat schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HeartbeatRequest(BaseModel):
    track: str | None = Field(default=None, max_length=16)
    page: str | None = Field(default=None, max_length=200)


class HeartbeatResponse(BaseModel):
    session_id: str
    added_seconds: int
    session_active_seconds: int
    last_heartbeat_at: str
