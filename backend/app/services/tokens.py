"""Email verification and password-reset tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import EmailToken

VERIFY_TTL = timedelta(days=2)
RESET_TTL = timedelta(hours=1)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_email_token(
    db: Session,
    *,
    user_id: uuid.UUID,
    purpose: str,
    commit: bool = True,
) -> str:
    raw = secrets.token_urlsafe(32)
    ttl = VERIFY_TTL if purpose == "verify" else RESET_TTL
    token = EmailToken(
        id=uuid.uuid4(),
        user_id=user_id,
        purpose=purpose,
        token_hash=_hash(raw),
        expires_at=datetime.now(UTC) + ttl,
    )
    db.add(token)
    if commit:
        db.commit()
    else:
        db.flush()
    return raw


def consume_email_token(db: Session, *, raw_token: str, purpose: str) -> EmailToken | None:
    now = datetime.now(UTC)
    token = db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == _hash(raw_token),
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > now,
        )
    )
    if token is None:
        return None
    token.used_at = now
    db.commit()
    db.refresh(token)
    return token
