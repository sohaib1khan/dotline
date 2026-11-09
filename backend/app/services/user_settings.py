"""Read and update per-user settings and account fields."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User, UserSetting
from app.schemas.settings import AccountUpdateRequest, UserSettingsUpdate
from app.security.passwords import hash_password, verify_password
from app.services.validation import validate_password, validate_username


def get_or_create_settings(db: Session, user: User) -> UserSetting:
    settings = db.get(UserSetting, user.id)
    if settings is None:
        settings = UserSetting(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, user: User, payload: UserSettingsUpdate) -> UserSetting:
    settings = get_or_create_settings(db, user)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


def update_account(db: Session, user: User, payload: AccountUpdateRequest) -> User:
    if payload.username is not None:
        username = validate_username(payload.username)
        taken = db.scalar(
            select(User).where(
                func.lower(User.username) == username.lower(),
                User.id != user.id,
            )
        )
        if taken is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"username": "This username is already taken."},
            )
        user.username = username

    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"current_password": "Current password is required."},
            )
        if not verify_password(user.password_hash, payload.current_password):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"current_password": "Current password is incorrect."},
            )
        pwd = validate_password(payload.new_password, confirm=payload.confirm_password)
        user.password_hash = hash_password(pwd)

    if payload.username is None and payload.new_password is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nothing to update.",
        )

    db.commit()
    db.refresh(user)
    return user
