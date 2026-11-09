"""Create, resolve, and revoke server-side sessions."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.session import SessionRecord
from app.models.user import User

SESSION_TTL = timedelta(days=14)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(
    db: Session,
    user: User,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[SessionRecord, str]:
    raw_token = secrets.token_urlsafe(32)
    record = SessionRecord(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(UTC) + SESSION_TTL,
        ip=ip,
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, raw_token


def get_user_for_session_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    now = datetime.now(UTC)
    record = db.scalar(
        select(SessionRecord).where(
            SessionRecord.token_hash == hash_token(token),
            SessionRecord.revoked_at.is_(None),
            SessionRecord.expires_at > now,
        )
    )
    if record is None:
        return None
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        return None
    return user


def revoke_session_token(db: Session, token: str | None) -> None:
    if not token:
        return
    record = db.scalar(select(SessionRecord).where(SessionRecord.token_hash == hash_token(token)))
    if record is None or record.revoked_at is not None:
        return
    record.revoked_at = datetime.now(UTC)
    db.commit()


def revoke_user_sessions(db: Session, user_id: uuid.UUID, *, commit: bool = True) -> int:
    now = datetime.now(UTC)
    rows = db.scalars(
        select(SessionRecord).where(
            SessionRecord.user_id == user_id,
            SessionRecord.revoked_at.is_(None),
        )
    ).all()
    for record in rows:
        record.revoked_at = now
    if commit:
        db.commit()
    return len(rows)
