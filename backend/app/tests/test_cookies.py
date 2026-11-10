"""Cookie Secure flag is opt-in for self-hosted HTTP → HTTPS upgrades."""

from app.config import get_settings
from app.security.cookies import cookie_secure


def _reload(monkeypatch, **env: str) -> None:
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def test_cookie_secure_default_false(monkeypatch) -> None:
    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    _reload(monkeypatch, APP_ENV="production", PUBLIC_BASE_URL="https://dotline.myschool.org")
    assert cookie_secure() is False


def test_cookie_secure_explicit_true(monkeypatch) -> None:
    _reload(
        monkeypatch,
        APP_ENV="production",
        PUBLIC_BASE_URL="https://dotline.myschool.org",
        COOKIE_SECURE="true",
    )
    assert cookie_secure() is True


def test_cookie_secure_explicit_false(monkeypatch) -> None:
    _reload(
        monkeypatch,
        APP_ENV="production",
        PUBLIC_BASE_URL="https://dotline.myschool.org",
        COOKIE_SECURE="false",
    )
    assert cookie_secure() is False
