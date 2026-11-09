"""Learner inbox routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.inbox import InboxListResponse, InboxMessage, UnreadCountResponse
from app.security.deps import get_current_user, require_csrf
from app.services import inbox as inbox_service

router = APIRouter(prefix="/api/inbox", tags=["inbox"])


@router.get("", response_model=InboxListResponse)
def get_inbox(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InboxListResponse:
    rows = inbox_service.list_messages(db, user.id)
    return InboxListResponse(
        messages=[InboxMessage(**inbox_service.message_public(row)) for row in rows],
        unread_count=inbox_service.unread_count(db, user.id),
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    return UnreadCountResponse(unread_count=inbox_service.unread_count(db, user.id))


@router.post("/{message_id}/read", response_model=InboxMessage, dependencies=[Depends(require_csrf)])
def mark_read(
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InboxMessage:
    row = inbox_service.mark_read(db, user.id, message_id)
    return InboxMessage(**inbox_service.message_public(row))


@router.post("/read-all", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
def mark_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    count = inbox_service.mark_all_read(db, user.id)
    return MessageResponse(message=f"Marked {count} messages read.")
