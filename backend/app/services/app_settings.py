"""Read/write app_settings rows, with encryption for secrets."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.settings import AppSetting
from app.security.encryption import decrypt_secret, encrypt_secret, mask_secret

KEY_RESEND_API = "email.resend_api_key"
KEY_FROM_NAME = "email.from_name"
KEY_FROM_EMAIL = "email.from_email"
KEY_SIGNUPS_OPEN = "signups.open"
KEY_APP_NAME = "general.app_name"
KEY_DEFAULT_DAILY_GOAL = "general.default_daily_goal_minutes"


def get_setting(db: Session, key: str) -> str | None:
    row = db.get(AppSetting, key)
    return None if row is None else row.value


def set_setting(
    db: Session,
    key: str,
    value: str,
    *,
    updated_by: uuid.UUID | None,
    encrypt: bool = False,
) -> AppSetting:
    stored = encrypt_secret(value) if encrypt else value
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value=stored, updated_by=updated_by)
        db.add(row)
    else:
        row.value = stored
        row.updated_by = updated_by
        row.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return row


def get_resend_api_key(db: Session) -> str | None:
    raw = get_setting(db, KEY_RESEND_API)
    if not raw:
        return None
    return decrypt_secret(raw)


def email_is_configured(db: Session) -> bool:
    key = get_setting(db, KEY_RESEND_API)
    from_email = get_setting(db, KEY_FROM_EMAIL)
    return bool(key and from_email)


def signups_open(db: Session) -> bool:
    """Learner sign-ups are open by default; admin can close via signups.open.

    Email/Resend is optional: without it, new accounts are auto-verified.
    """
    flag = get_setting(db, KEY_SIGNUPS_OPEN)
    if flag is None:
        return True
    return flag.lower() in {"1", "true", "yes", "open"}


def email_settings_public(db: Session) -> dict:
    encrypted = get_setting(db, KEY_RESEND_API)
    masked = None
    has_key = False
    if encrypted:
        has_key = True
        try:
            masked = mask_secret(decrypt_secret(encrypted))
        except ValueError:
            masked = "re_••••****"
    return {
        "configured": email_is_configured(db),
        "has_api_key": has_key,
        "api_key_masked": masked,
        "from_name": get_setting(db, KEY_FROM_NAME) or "",
        "from_email": get_setting(db, KEY_FROM_EMAIL) or "",
        "signups_open": signups_open(db),
    }


def list_settings_keys(db: Session) -> list[str]:
    rows = db.scalars(select(AppSetting.key)).all()
    return list(rows)


def set_signups_open(db: Session, *, open_: bool, updated_by: uuid.UUID | None) -> bool:
    set_setting(db, KEY_SIGNUPS_OPEN, "true" if open_ else "false", updated_by=updated_by)
    return open_


def general_settings_public(db: Session) -> dict:
    raw_goal = get_setting(db, KEY_DEFAULT_DAILY_GOAL)
    try:
        goal = int(raw_goal) if raw_goal else 10
    except ValueError:
        goal = 10
    if goal not in {5, 10, 20}:
        goal = 10
    return {
        "app_name": get_setting(db, KEY_APP_NAME) or "Dotline",
        "default_daily_goal_minutes": goal,
        "signups_open": signups_open(db),
    }


def update_general_settings(
    db: Session,
    *,
    app_name: str,
    default_daily_goal_minutes: int,
    updated_by: uuid.UUID | None,
) -> dict:
    name = app_name.strip()[:80] or "Dotline"
    if default_daily_goal_minutes not in {5, 10, 20}:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"default_daily_goal_minutes": "Choose 5, 10, or 20."},
        )
    set_setting(db, KEY_APP_NAME, name, updated_by=updated_by)
    set_setting(
        db,
        KEY_DEFAULT_DAILY_GOAL,
        str(default_daily_goal_minutes),
        updated_by=updated_by,
    )
    return general_settings_public(db)
