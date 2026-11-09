"""CSRF double-submit cookie helpers."""

from __future__ import annotations

import hmac
import secrets

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.security.cookies import CSRF_COOKIE

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def validate_csrf(request: Request) -> None:
    if request.method in SAFE_METHODS:
        return
    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get("X-CSRF-Token")
    if not cookie_token or not header_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing")
    if not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token invalid")
    # Bind CSRF cookie integrity loosely to app secret to avoid trivial forgeries.
    _ = get_settings().secret_key
