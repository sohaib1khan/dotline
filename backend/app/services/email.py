"""Outbound email via Resend."""

from __future__ import annotations

import httpx
from sqlalchemy.orm import Session

from app.services import app_settings as settings_service


class EmailError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def send_email(
    db: Session,
    *,
    to: str,
    subject: str,
    html: str,
    text: str,
) -> None:
    api_key = settings_service.get_resend_api_key(db)
    from_email = settings_service.get_setting(db, settings_service.KEY_FROM_EMAIL)
    from_name = settings_service.get_setting(db, settings_service.KEY_FROM_NAME) or "Dotline"
    if not api_key or not from_email:
        raise EmailError("Email is not configured")

    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20.0,
        )
    except httpx.HTTPError as exc:
        raise EmailError(f"Failed to reach Resend: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:300]
        if response.status_code in {401, 403}:
            raise EmailError(
                "Email provider rejected the API key. Ask the admin to replace the Resend key."
            )
        raise EmailError(f"Resend error ({response.status_code}): {detail}")
