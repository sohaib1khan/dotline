"""Admin broadcast announcements into learner inboxes."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.services import inbox as inbox_service


def broadcast(
    db: Session,
    admin: User,
    *,
    title: str,
    body: str,
) -> dict:
    clean_title = title.strip()[:200]
    clean_body = body.strip()
    if len(clean_title) < 2 or len(clean_body) < 2:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"title": "Title and body are required."},
        )

    learners = db.scalars(
        select(User).where(User.role == UserRole.LEARNER.value, User.is_active.is_(True))
    ).all()
    sender = admin.username or "admin"
    for learner in learners:
        inbox_service.create_message(
            db,
            user_id=learner.id,
            kind="announcement",
            title=clean_title,
            body=clean_body,
            sender=sender,
            commit=False,
        )
    db.commit()
    return {
        "ok": True,
        "delivered": len(learners),
        "title": clean_title,
        "message": f"Announcement delivered to {len(learners)} learners.",
    }
