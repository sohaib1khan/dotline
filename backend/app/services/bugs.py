"""Bug report intake and admin replies."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bugs import BugReport
from app.models.user import User
from app.services import badges as badge_service
from app.services import inbox as inbox_service

BUG_CATEGORIES = [
    "sound_not_working",
    "vibration_not_working",
    "controller_problem",
    "hard_to_see_read",
    "lesson_stuck_or_wrong",
    "tracing_not_scoring",
    "login_or_account",
    "layout_broken",
    "other",
]

CATEGORY_LABELS = {
    "sound_not_working": "Sound not working",
    "vibration_not_working": "Vibration not working",
    "controller_problem": "Controller problem",
    "hard_to_see_read": "Hard to see / read",
    "lesson_stuck_or_wrong": "Lesson stuck or wrong",
    "tracing_not_scoring": "Tracing not scoring right",
    "login_or_account": "Login or account",
    "layout_broken": "Layout looks broken",
    "other": "Other",
}


def _rate_limited(db: Session, user_id: uuid.UUID) -> bool:
    since = datetime.now(UTC) - timedelta(hours=1)
    count = db.scalar(
        select(func.count())
        .select_from(BugReport)
        .where(BugReport.user_id == user_id, BugReport.created_at >= since)
    )
    return bool(count and count >= 10)


def create_report(
    db: Session,
    user: User,
    *,
    category: str,
    description: str,
    context: dict[str, Any],
) -> BugReport:
    if category not in BUG_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"category": "Unknown category."},
        )
    if _rate_limited(db, user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reports this hour. Try again later.",
        )
    row = BugReport(
        user_id=user.id,
        category=category,
        description=(description or "").strip()[:4000],
        context=context or {},
        status="open",
    )
    db.add(row)
    db.flush()
    badge_service.award_badge(db, user_id=user.id, badge_key="bug_hunter", commit=False)
    db.commit()
    db.refresh(row)
    return row


def list_user_reports(db: Session, user_id: uuid.UUID) -> list[BugReport]:
    return list(
        db.scalars(
            select(BugReport)
            .where(BugReport.user_id == user_id)
            .order_by(BugReport.created_at.desc())
            .limit(50)
        ).all()
    )


def list_all_reports(db: Session, *, status_filter: str | None = None) -> list[BugReport]:
    stmt = select(BugReport).order_by(BugReport.created_at.desc()).limit(100)
    if status_filter:
        stmt = stmt.where(BugReport.status == status_filter)
    return list(db.scalars(stmt).all())


def get_report(db: Session, report_id: uuid.UUID) -> BugReport:
    row = db.get(BugReport, report_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")
    return row


def reply_to_report(
    db: Session,
    admin: User,
    *,
    report_id: uuid.UUID,
    reply: str,
    status_value: str | None = None,
) -> BugReport:
    row = get_report(db, report_id)
    text = reply.strip()
    if len(text) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"reply": "Reply cannot be empty."},
        )
    row.admin_note = text[:4000]
    if status_value in {"open", "in_progress", "fixed", "wont_fix"}:
        row.status = status_value
    elif row.status == "open":
        row.status = "in_progress"
    row.updated_at = datetime.now(UTC)
    label = CATEGORY_LABELS.get(row.category, row.category)
    inbox_service.create_message(
        db,
        user_id=row.user_id,
        kind="reply",
        title=f"Reply to your report: {label}",
        body=text,
        sender=admin.username or "admin",
        commit=False,
    )
    db.commit()
    db.refresh(row)
    return row


def report_public(row: BugReport, *, include_context: bool = False) -> dict:
    payload = {
        "id": str(row.id),
        "category": row.category,
        "category_label": CATEGORY_LABELS.get(row.category, row.category),
        "description": row.description,
        "status": row.status,
        "admin_note": row.admin_note,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "user_id": str(row.user_id),
    }
    if include_context:
        payload["context"] = row.context or {}
    return payload
