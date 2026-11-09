"""Inbox schemas."""

from __future__ import annotations

from pydantic import BaseModel


class InboxMessage(BaseModel):
    id: str
    kind: str
    sender: str
    title: str
    body: str
    read_at: str | None
    created_at: str
    is_broadcast: bool = False


class InboxListResponse(BaseModel):
    messages: list[InboxMessage]
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int
