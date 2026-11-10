"""Admin CRUD for login audit events."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.auth import LoginEvent
from app.models.user import User
from app.services.monitoring import _login_public, search_login_events


def get_login_event(db: Session, event_id: uuid.UUID) -> dict[str, Any]:
    row = db.get(LoginEvent, event_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login event not found")
    return _login_public(row)


def create_login_event(
    db: Session,
    *,
    email_attempted: str,
    success: bool,
    ip: str | None = None,
    device_summary: str | None = None,
    user_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    email = email_attempted.strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"email_attempted": "Email or login is required."},
        )
    if user_id is not None and db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    row = LoginEvent(
        user_id=user_id,
        email_attempted=email[:320],
        success=success,
        ip=(ip.strip()[:64] if ip and ip.strip() else None),
        user_agent=None,
        device_summary=(device_summary.strip()[:255] if device_summary and device_summary.strip() else None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _login_public(row)


def update_login_event(
    db: Session,
    event_id: uuid.UUID,
    *,
    email_attempted: str | None = None,
    success: bool | None = None,
    ip: str | None = None,
    device_summary: str | None = None,
    clear_ip: bool = False,
    clear_device_summary: bool = False,
) -> dict[str, Any]:
    row = db.get(LoginEvent, event_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login event not found")

    if email_attempted is not None:
        email = email_attempted.strip()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"email_attempted": "Email or login is required."},
            )
        row.email_attempted = email[:320]
    if success is not None:
        row.success = success
    if clear_ip:
        row.ip = None
    elif ip is not None:
        row.ip = ip.strip()[:64] or None
    if clear_device_summary:
        row.device_summary = None
    elif device_summary is not None:
        row.device_summary = device_summary.strip()[:255] or None

    db.commit()
    db.refresh(row)
    return _login_public(row)


def delete_login_event(db: Session, event_id: uuid.UUID) -> None:
    row = db.get(LoginEvent, event_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login event not found")
    db.delete(row)
    db.commit()


def purge_login_events(
    db: Session,
    *,
    success: Literal["all", "success", "fail"] = "fail",
    older_than_days: int | None = None,
    user_id: uuid.UUID | None = None,
) -> dict[str, int]:
    stmt = delete(LoginEvent)
    filters = []
    if success == "success":
        filters.append(LoginEvent.success.is_(True))
    elif success == "fail":
        filters.append(LoginEvent.success.is_(False))
    if older_than_days is not None:
        if older_than_days < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"older_than_days": "Must be zero or greater."},
            )
        cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
        filters.append(LoginEvent.created_at < cutoff)
    if user_id is not None:
        filters.append(LoginEvent.user_id == user_id)
    if filters:
        from sqlalchemy import and_

        stmt = stmt.where(and_(*filters))

    result = db.execute(stmt)
    db.commit()
    return {"deleted": int(result.rowcount or 0)}


def list_login_events_for_user(db: Session, user_id: uuid.UUID, *, limit: int = 50) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(LoginEvent)
        .where(LoginEvent.user_id == user_id)
        .order_by(LoginEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [_login_public(row) for row in rows]


__all__ = [
    "create_login_event",
    "delete_login_event",
    "get_login_event",
    "list_login_events_for_user",
    "purge_login_events",
    "search_login_events",
    "update_login_event",
]
