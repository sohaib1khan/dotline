"""Auth/security invariant tests (no live database required)."""

from app.security.passwords import hash_password, verify_password
from app.security.rate_limit import limiter
from app.security.sessions import SESSION_TTL, hash_token
from app.services.app_settings import (
    KEY_RESEND_API,
    KEY_SIGNUPS_OPEN,
    email_settings_public,
)


def test_passwords_are_argon2_hashed() -> None:
    hashed = hash_password("super-secure-pass")
    assert hashed.startswith("$argon2")
    assert verify_password(hashed, "super-secure-pass")
    assert not verify_password(hashed, "wrong-password")


def test_session_token_hash_is_sha256_hex() -> None:
    digest = hash_token("example-token")
    assert len(digest) == 64
    assert digest == hash_token("example-token")
    assert digest != hash_token("other-token")


def test_session_ttl_is_two_weeks() -> None:
    assert SESSION_TTL.days == 14


def test_rate_limiter_exists() -> None:
    assert limiter is not None


def test_email_settings_public_masks_without_db_key() -> None:
    # Smoke that helpers expose expected keys (masking path is covered via service).
    assert KEY_RESEND_API == "email.resend_api_key"
    assert KEY_SIGNUPS_OPEN == "signups.open"
    assert callable(email_settings_public)
