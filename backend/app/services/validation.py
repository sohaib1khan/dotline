"""Server-side signup/setup field validation."""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, status

_CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

_NAME_RE = re.compile(r"^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$", re.UNICODE)
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,24}$")
_KEYBOARD_ROWS = (
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
    "qwerty",
    "asdf",
    "zxcv",
)


@lru_cache
def _disposable_domains() -> set[str]:
    path = _CONTENT_DIR / "disposable_email_domains.txt"
    return {line.strip().lower() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


@lru_cache
def _common_passwords() -> set[str]:
    path = _CONTENT_DIR / "common_passwords.txt"
    return {line.strip().lower() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).lower()


def validate_person_name(value: str, *, field: str) -> str:
    cleaned = value.strip()
    if len(cleaned) < 2 or len(cleaned) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={field: f"{field.replace('_', ' ').title()} must be 2–50 characters."},
        )
    if any(ch.isdigit() for ch in cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={field: "Names cannot include numbers."},
        )
    if not _NAME_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={field: "Use letters, spaces, hyphens, or apostrophes only."},
        )
    folded = _fold(cleaned.replace(" ", "").replace("-", "").replace("'", ""))
    if re.search(r"(.)\1\1", folded):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={field: "That name looks invalid. Please use your real name."},
        )
    for row in _KEYBOARD_ROWS:
        if row in folded:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={field: "That name looks invalid. Please use your real name."},
            )
    # Repeated short syllable like "lalala" / "nana"
    if re.search(r"^(.{2,3})\1+$", folded):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={field: "That name looks invalid. Please use your real name."},
        )
    return cleaned


def validate_username(value: str) -> str:
    cleaned = value.strip()
    if not _USERNAME_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"username": "Username must be 3–24 letters, numbers, or underscore."},
        )
    return cleaned


def validate_email_address(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"email": "Enter a valid email address."},
        )
    domain = email.rsplit("@", 1)[-1]
    if domain in _disposable_domains():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"email": "Disposable email addresses are not allowed."},
        )
    return email


def validate_password(password: str, *, confirm: str | None = None) -> str:
    if len(password) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"password": "Password must be at least 12 characters."},
        )
    if len(password) > 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"password": "Password is too long."},
        )
    if password.lower() in _common_passwords():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"password": "This password is too common. Choose a stronger one."},
        )
    if confirm is not None and password != confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"confirm_password": "Passwords do not match."},
        )
    return password


def field_error_response(detail: dict[str, str]) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
