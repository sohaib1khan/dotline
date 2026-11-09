"""Admin settings: email / Resend configuration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.admin_settings import (
    EmailSettingsResponse,
    EmailSettingsUpdateRequest,
    TestEmailResponse,
)
from app.security.deps import require_admin, require_csrf
from app.services import app_settings as settings_service
from app.services.email import EmailError, send_email

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


@router.get("/email", response_model=EmailSettingsResponse)
def get_email_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> EmailSettingsResponse:
    return EmailSettingsResponse(**settings_service.email_settings_public(db))


@router.put("/email", response_model=EmailSettingsResponse, dependencies=[Depends(require_csrf)])
def update_email_settings(
    payload: EmailSettingsUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> EmailSettingsResponse:
    settings_service.set_setting(
        db,
        settings_service.KEY_FROM_NAME,
        payload.from_name.strip(),
        updated_by=admin.id,
    )
    settings_service.set_setting(
        db,
        settings_service.KEY_FROM_EMAIL,
        str(payload.from_email).strip().lower(),
        updated_by=admin.id,
    )

    if payload.replace_api_key or not settings_service.get_setting(db, settings_service.KEY_RESEND_API):
        if not payload.api_key:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"api_key": "Resend API key is required."},
            )
        settings_service.set_setting(
            db,
            settings_service.KEY_RESEND_API,
            payload.api_key.strip(),
            updated_by=admin.id,
            encrypt=True,
        )

    # Default signups open once email is configured.
    if settings_service.get_setting(db, settings_service.KEY_SIGNUPS_OPEN) is None:
        settings_service.set_setting(
            db,
            settings_service.KEY_SIGNUPS_OPEN,
            "true",
            updated_by=admin.id,
        )

    return EmailSettingsResponse(**settings_service.email_settings_public(db))


@router.post("/email/test", response_model=TestEmailResponse, dependencies=[Depends(require_csrf)])
def send_test_email(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> TestEmailResponse:
    if not settings_service.email_is_configured(db):
        return TestEmailResponse(ok=False, message="Save a Resend API key and From email first.")
    try:
        send_email(
            db,
            to=admin.email,
            subject="Dotline test email",
            html="<p><strong>Success.</strong> Dotline email is configured.</p>",
            text="Success. Dotline email is configured.",
        )
    except EmailError as exc:
        return TestEmailResponse(ok=False, message=exc.message)
    return TestEmailResponse(ok=True, message=f"Test email sent to {admin.email}.")
