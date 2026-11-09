"""Authentication business logic: login, signup, verify, reset."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.auth import LoginEvent
from app.models.user import User, UserRole, UserSetting
from app.security.passwords import hash_password, verify_password
from app.services import app_settings as settings_service
from app.services.email import EmailError, send_email
from app.services.tokens import consume_email_token, create_email_token
from app.services.validation import (
    validate_email_address,
    validate_password,
    validate_person_name,
    validate_username,
)


def record_login_event(
    db: Session,
    *,
    user: User | None,
    email_attempted: str,
    success: bool,
    ip: str | None,
    user_agent: str | None,
) -> None:
    db.add(
        LoginEvent(
            user_id=None if user is None else user.id,
            email_attempted=email_attempted[:320],
            success=success,
            ip=ip,
            user_agent=user_agent,
            device_summary=(user_agent or "")[:255] or None,
        )
    )
    db.commit()


def login_rate_limited(db: Session, *, account_key: str, ip: str) -> bool:
    since = datetime.now(UTC) - timedelta(minutes=15)
    failed = db.scalar(
        select(func.count())
        .select_from(LoginEvent)
        .where(
            LoginEvent.success.is_(False),
            LoginEvent.created_at >= since,
            LoginEvent.ip == ip,
            func.lower(LoginEvent.email_attempted) == account_key.lower(),
        )
    )
    return bool(failed and failed >= 5)


def find_user_by_login(db: Session, login: str) -> User | None:
    key = login.strip().lower()
    return db.scalar(
        select(User).where(or_(func.lower(User.email) == key, func.lower(User.username) == key))
    )


def authenticate_user(
    db: Session,
    *,
    login: str,
    password: str,
    ip: str,
    user_agent: str | None,
) -> User:
    account_key = login.strip()
    if login_rate_limited(db, account_key=account_key, ip=ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again in 15 minutes.",
        )

    user = find_user_by_login(db, login)
    password_ok = bool(user and verify_password(user.password_hash, password))
    if not password_ok:
        record_login_event(
            db,
            user=user,
            email_attempted=account_key,
            success=False,
            ip=ip,
            user_agent=user_agent,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    assert user is not None
    if not user.is_active:
        record_login_event(
            db,
            user=user,
            email_attempted=account_key,
            success=False,
            ip=ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is waiting for an admin to approve it.",
        )

    record_login_event(
        db,
        user=user,
        email_attempted=account_key,
        success=True,
        ip=ip,
        user_agent=user_agent,
    )
    user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def register_learner(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    username: str,
    email: str,
    password: str,
    confirm_password: str,
) -> tuple[User, bool]:
    """Create a learner. Returns (user, verification_required)."""
    if not settings_service.signups_open(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign-ups are temporarily closed.",
        )

    first = validate_person_name(first_name, field="first_name")
    last = validate_person_name(last_name, field="last_name")
    uname = validate_username(username)
    mail = validate_email_address(email)
    pwd = validate_password(password, confirm=confirm_password)

    existing = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == uname.lower(), func.lower(User.email) == mail)
        )
    )
    if existing is not None:
        if existing.email.lower() == mail:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"email": "An account with this email already exists."},
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"username": "This username is already taken."},
        )

    # First account on an empty install is always admin (setup / recovery).
    from app.services.setup import admin_exists, clear_admin_exists_cache

    make_admin = not admin_exists(db, use_cache=False)
    email_ready = settings_service.email_is_configured(db)
    needs_verification = (
        False if make_admin else settings_service.require_email_verification(db)
    )
    # Resend working → learners self-confirm by email (or auto-verify if admin
    # turned verification off). Without Resend → create inactive until admin approves.
    pending_approval = False if make_admin or email_ready else True
    user = User(
        first_name=first,
        last_name=last,
        username=uname,
        email=mail,
        password_hash=hash_password(pwd),
        role=UserRole.ADMIN.value if make_admin else UserRole.LEARNER.value,
        email_verified_at=None if needs_verification else datetime.now(UTC),
        is_active=not pending_approval,
    )
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    db.flush()

    if not needs_verification:
        db.commit()
        db.refresh(user)
        if make_admin:
            clear_admin_exists_cache()
            admin_exists(db, use_cache=False)
        return user, False

    try:
        send_verification_email(db, user, commit=False)
        db.commit()
        db.refresh(user)
    except HTTPException:
        db.rollback()
        raise
    return user, True


def send_verification_email(db: Session, user: User, *, commit: bool = True) -> None:
    raw = create_email_token(db, user_id=user.id, purpose="verify", commit=commit)
    base = settings_service.public_base_url(db)
    link = f"{base}/verify-email?token={raw}"
    try:
        send_email(
            db,
            to=user.email,
            subject="Verify your Dotline account",
            html=(
                f"<p>Hi {user.first_name},</p>"
                f"<p>Confirm your email to start learning:</p>"
                f'<p><a href="{link}">Verify email</a></p>'
                f"<p>Or paste this link: {link}</p>"
            ),
            text=f"Hi {user.first_name},\n\nVerify your email: {link}\n",
        )
    except EmailError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc
    if commit:
        db.commit()


def verify_email_token(db: Session, raw_token: str) -> User:
    token = consume_email_token(db, raw_token=raw_token, purpose="verify")
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")
    user.email_verified_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def request_password_reset(db: Session, email: str) -> None:
    mail = email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == mail))
    # Always look successful to avoid account enumeration.
    if user is None or not user.is_active:
        return
    if not settings_service.email_is_configured(db):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email is not configured")

    raw = create_email_token(db, user_id=user.id, purpose="reset")
    base = settings_service.public_base_url(db)
    link = f"{base}/reset-password?token={raw}"
    try:
        send_email(
            db,
            to=user.email,
            subject="Reset your Dotline password",
            html=(
                f"<p>Hi {user.first_name},</p>"
                f"<p>Reset your password (link expires in 1 hour):</p>"
                f'<p><a href="{link}">Reset password</a></p>'
            ),
            text=f"Hi {user.first_name},\n\nReset your password: {link}\n",
        )
    except EmailError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc


def reset_password(db: Session, *, raw_token: str, password: str, confirm_password: str) -> User:
    pwd = validate_password(password, confirm=confirm_password)
    token = consume_email_token(db, raw_token=raw_token, purpose="reset")
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")
    user.password_hash = hash_password(pwd)
    db.commit()
    db.refresh(user)
    return user
