"""Cookie Secure flag policy for LAN HTTP vs production HTTPS."""

from app.config import get_settings
from app.security.cookies import cookie_secure


def _reload(monkeypatch, **env: str) -> None:
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def test_cookie_secure_false_for_localhost_http(monkeypatch) -> None:
    _reload(monkeypatch, APP_ENV="production", PUBLIC_BASE_URL="http://localhost:47391")
    assert cookie_secure() is False


def test_cookie_secure_false_for_example_https_placeholder(monkeypatch) -> None:
    _reload(monkeypatch, APP_ENV="production", PUBLIC_BASE_URL="https://dotline.example.com")
    assert cookie_secure() is False


def test_cookie_secure_true_for_real_https(monkeypatch) -> None:
    _reload(monkeypatch, APP_ENV="production", PUBLIC_BASE_URL="https://dotline.myschool.org")
    assert cookie_secure() is True


def test_cookie_secure_explicit_override(monkeypatch) -> None:
    _reload(
        monkeypatch,
        APP_ENV="production",
        PUBLIC_BASE_URL="https://dotline.myschool.org",
        COOKIE_SECURE="false",
    )
    assert cookie_secure() is False
