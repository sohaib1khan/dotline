"""Admin user search, detail, and account actions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.activity import ActivityDaily
from app.models.auth import LoginEvent
from app.models.user import User, UserRole, UserTrack
from app.security import sessions as session_service
from app.services import bugs as bugs_service
from app.services import progress as progress_service
from app.services import tracks as track_service


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def user_summary(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "email_verified_at": _iso(user.email_verified_at),
        "created_at": _iso(user.created_at),
        "last_login_at": _iso(user.last_login_at),
    }


def search_users(
    db: Session,
    *,
    q: str | None = None,
    role: str | None = None,
    status_filter: Literal["active", "disabled", "all"] = "all",
    verified: Literal["yes", "no", "all"] = "all",
    limit: int = 50,
) -> list[dict[str, Any]]:
    stmt = select(User).order_by(User.created_at.desc()).limit(min(max(limit, 1), 100))
    if q:
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.username).like(term),
                func.lower(User.email).like(term),
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
            )
        )
    if role in {UserRole.ADMIN.value, UserRole.LEARNER.value}:
        stmt = stmt.where(User.role == role)
    if status_filter == "active":
        stmt = stmt.where(User.is_active.is_(True))
    elif status_filter == "disabled":
        stmt = stmt.where(User.is_active.is_(False))
    if verified == "yes":
        stmt = stmt.where(User.email_verified_at.is_not(None))
    elif verified == "no":
        stmt = stmt.where(User.email_verified_at.is_(None))
    return [user_summary(row) for row in db.scalars(stmt).all()]


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def user_detail(db: Session, user_id: uuid.UUID) -> dict[str, Any]:
    user = get_user(db, user_id)
    active_seconds = db.scalar(
        select(func.coalesce(func.sum(ActivityDaily.active_seconds), 0)).where(
            ActivityDaily.user_id == user.id
        )
    )
    logins = db.scalars(
        select(LoginEvent)
        .where(LoginEvent.user_id == user.id)
        .order_by(LoginEvent.created_at.desc())
        .limit(25)
    ).all()
    return {
        **user_summary(user),
        "tracks": track_service.list_tracks(db, user.id),
        "progress": progress_service.build_progress(db, user),
        "total_active_seconds": int(active_seconds or 0),
        "login_history": [
            {
                "id": str(row.id),
                "success": row.success,
                "email_attempted": row.email_attempted,
                "ip": row.ip,
                "device_summary": row.device_summary,
                "created_at": _iso(row.created_at),
            }
            for row in logins
        ],
        "bug_reports": [
            bugs_service.report_public(row) for row in bugs_service.list_user_reports(db, user.id)
        ],
    }


def set_active(db: Session, admin: User, user_id: uuid.UUID, *, is_active: bool) -> dict[str, Any]:
    user = get_user(db, user_id)
    if user.id == admin.id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot disable your own account.",
        )
    user.is_active = is_active
    if not is_active:
        session_service.revoke_user_sessions(db, user.id, commit=False)
    db.commit()
    db.refresh(user)
    return user_summary(user)


def set_role(db: Session, admin: User, user_id: uuid.UUID, *, role: str) -> dict[str, Any]:
    if role not in {UserRole.ADMIN.value, UserRole.LEARNER.value}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")
    user = get_user(db, user_id)
    if user.id == admin.id and role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin role.",
        )
    if user.role == UserRole.ADMIN.value and role != UserRole.ADMIN.value:
        admin_count = db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
        )
        if int(admin_count or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin.",
            )
    user.role = role
    db.commit()
    db.refresh(user)
    return user_summary(user)


def reset_user_progress(
    db: Session,
    user_id: uuid.UUID,
    *,
    scope: progress_service.ResetScope,
    confirm: str,
) -> dict[str, Any]:
    user = get_user(db, user_id)
    return progress_service.reset_progress(db, user, scope=scope, confirm=confirm)


def delete_user(db: Session, admin: User, user_id: uuid.UUID, *, confirm_username: str) -> dict[str, str]:
    user = get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )
    if confirm_username.strip() != user.username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"confirm_username": "Type the username exactly to confirm delete."},
        )
    if user.role == UserRole.ADMIN.value:
        admin_count = db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
        )
        if int(admin_count or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin.",
            )
    username = user.username
    db.delete(user)
    db.commit()
    return {"message": f"Deleted user {username}."}


def enrolled_track_keys(db: Session, user_id: uuid.UUID) -> list[str]:
    rows = db.scalars(select(UserTrack.track).where(UserTrack.user_id == user_id)).all()
    return list(rows)
