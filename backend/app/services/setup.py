"""First-run admin setup service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, UserSetting
from app.schemas.setup import SetupCreateAdminRequest
from app.security.passwords import hash_password

_admin_exists_cache: bool | None = None


def clear_admin_exists_cache() -> None:
    global _admin_exists_cache
    _admin_exists_cache = None


def admin_known_to_exist() -> bool:
    return _admin_exists_cache is True


def admin_exists(db: Session, *, use_cache: bool = True) -> bool:
    global _admin_exists_cache
    if use_cache and _admin_exists_cache is True:
        return True

    count = db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
    )
    exists = bool(count and count > 0)
    if exists:
        _admin_exists_cache = True
    return exists


def create_first_admin(db: Session, payload: SetupCreateAdminRequest) -> User:
    if admin_exists(db, use_cache=False):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    username = payload.username.strip()
    email = str(payload.email).strip().lower()

    existing = db.scalar(
        select(User).where(
            (func.lower(User.username) == username.lower()) | (func.lower(User.email) == email)
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already in use",
        )

    user = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.ADMIN.value,
        email_verified_at=datetime.now(UTC),
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    db.commit()
    db.refresh(user)
    clear_admin_exists_cache()
    admin_exists(db, use_cache=False)
    return user
