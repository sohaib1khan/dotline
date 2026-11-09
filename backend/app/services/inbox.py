"""Inbox messages: alerts, replies, announcements."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.messaging import Message


def create_message(
    db: Session,
    *,
    user_id: uuid.UUID | None,
    kind: str,
    title: str,
    body: str,
    sender: str = "system",
    commit: bool = True,
) -> Message:
    row = Message(
        user_id=user_id,
        sender=sender,
        kind=kind,
        title=title[:200],
        body=body,
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row


def list_messages(db: Session, user_id: uuid.UUID) -> list[Message]:
    rows = db.scalars(
        select(Message)
        .where(or_(Message.user_id == user_id, Message.user_id.is_(None)))
        .order_by(Message.created_at.desc())
        .limit(100)
    ).all()
    return list(rows)


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    # Broadcasts without per-user receipts: count only personal unread for accuracy.
    count = db.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.user_id == user_id, Message.read_at.is_(None))
    )
    return int(count or 0)


def mark_read(db: Session, user_id: uuid.UUID, message_id: uuid.UUID) -> Message:
    row = db.get(Message, message_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if row.user_id is not None and row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    # Broadcasts have no per-user read state until announcements land fully.
    if row.user_id is None:
        return row
    if row.read_at is None:
        row.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(row)
    return row


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    rows = db.scalars(
        select(Message).where(Message.user_id == user_id, Message.read_at.is_(None))
    ).all()
    now = datetime.now(UTC)
    for row in rows:
        row.read_at = now
    db.commit()
    return len(rows)


def message_public(row: Message) -> dict:
    return {
        "id": str(row.id),
        "kind": row.kind,
        "sender": row.sender,
        "title": row.title,
        "body": row.body,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat(),
        "is_broadcast": row.user_id is None,
    }
