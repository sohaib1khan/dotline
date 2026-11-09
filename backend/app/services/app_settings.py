"""Read/write app_settings rows, with encryption for secrets."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.settings import AppSetting
from app.security.encryption import decrypt_secret, encrypt_secret, mask_secret

KEY_RESEND_API = "email.resend_api_key"
KEY_FROM_NAME = "email.from_name"
KEY_FROM_EMAIL = "email.from_email"
KEY_REPLY_TO = "email.reply_to"
KEY_REQUIRE_VERIFICATION = "email.require_verification"
KEY_SIGNUPS_OPEN = "signups.open"
KEY_APP_NAME = "general.app_name"
KEY_DEFAULT_DAILY_GOAL = "general.default_daily_goal_minutes"
KEY_SUPPORT_EMAIL = "general.support_email"
KEY_PUBLIC_BASE_URL = "general.public_base_url"
KEY_WELCOME_MESSAGE = "general.welcome_message"


def get_setting(db: Session, key: str) -> str | None:
    row = db.get(AppSetting, key)
    return None if row is None else row.value


def delete_setting(db: Session, key: str) -> None:
    row = db.get(AppSetting, key)
    if row is not None:
        db.delete(row)
        db.commit()


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


def require_email_verification(db: Session) -> bool:
    """When Resend is configured, verification is on unless admin turns it off."""
    if not email_is_configured(db):
        return False
    flag = get_setting(db, KEY_REQUIRE_VERIFICATION)
    if flag is None:
        return True
    return flag.lower() in {"1", "true", "yes", "on"}


def signups_open(db: Session) -> bool:
    """Learner sign-ups are open by default; admin can close via signups.open.

    With Resend configured, learners confirm themselves by email (or auto-verify
    if the admin turns verification off). Without Resend, new accounts stay
    inactive until an admin approves them.
    """
    flag = get_setting(db, KEY_SIGNUPS_OPEN)
    if flag is None:
        return True
    return flag.lower() in {"1", "true", "yes", "open"}


def signup_gate_mode(db: Session) -> str:
    """How new learner accounts get unlocked: email | admin | open."""
    if not signups_open(db):
        return "closed"
    if not email_is_configured(db):
        return "admin"
    if require_email_verification(db):
        return "email"
    return "open"


def public_base_url(db: Session) -> str:
    override = get_setting(db, KEY_PUBLIC_BASE_URL)
    if override:
        return override.rstrip("/")
    return get_settings().public_base_url.rstrip("/")


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
        "reply_to": get_setting(db, KEY_REPLY_TO) or "",
        "require_verification": require_email_verification(db) if has_key else False,
        "public_base_url": public_base_url(db),
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
    goal = max(1, min(180, goal))
    return {
        "app_name": get_setting(db, KEY_APP_NAME) or "Dotline",
        "default_daily_goal_minutes": goal,
        "support_email": get_setting(db, KEY_SUPPORT_EMAIL) or "",
        "public_base_url": public_base_url(db),
        "welcome_message": get_setting(db, KEY_WELCOME_MESSAGE)
        or "Choose a room to practice — one calm space at a time.",
        "signups_open": signups_open(db),
    }


def update_general_settings(
    db: Session,
    *,
    app_name: str,
    default_daily_goal_minutes: int,
    support_email: str | None,
    public_base_url_value: str | None,
    welcome_message: str | None,
    updated_by: uuid.UUID | None,
) -> dict:
    name = app_name.strip()[:80] or "Dotline"
    if default_daily_goal_minutes < 1 or default_daily_goal_minutes > 180:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"default_daily_goal_minutes": "Choose a value from 1 to 180 minutes."},
        )
    set_setting(db, KEY_APP_NAME, name, updated_by=updated_by)
    set_setting(
        db,
        KEY_DEFAULT_DAILY_GOAL,
        str(int(default_daily_goal_minutes)),
        updated_by=updated_by,
    )
    if support_email is not None:
        if support_email:
            set_setting(db, KEY_SUPPORT_EMAIL, support_email, updated_by=updated_by)
        else:
            delete_setting(db, KEY_SUPPORT_EMAIL)
    if public_base_url_value is not None:
        if public_base_url_value:
            set_setting(db, KEY_PUBLIC_BASE_URL, public_base_url_value, updated_by=updated_by)
        else:
            delete_setting(db, KEY_PUBLIC_BASE_URL)
    if welcome_message is not None:
        if welcome_message:
            set_setting(db, KEY_WELCOME_MESSAGE, welcome_message[:500], updated_by=updated_by)
        else:
            delete_setting(db, KEY_WELCOME_MESSAGE)
    return general_settings_public(db)
