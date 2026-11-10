"""Cookie policy helpers for session and CSRF cookies."""

from urllib.parse import urlparse

from app.config import get_settings

SESSION_COOKIE = "dotline_session"
CSRF_COOKIE = "dotline_csrf"


def cookie_secure() -> bool:
    """Whether Set-Cookie should include Secure.

    Browsers drop Secure cookies on plain HTTP. Self-hosters often open the app
    at http://lan-ip:port before Nginx Proxy Manager / HTTPS is ready, so we must
    not force Secure merely because .env.example used an https:// placeholder.
    """
    settings = get_settings()
    if settings.cookie_secure is not None:
        return settings.cookie_secure
    if settings.app_env == "development":
        return False

    raw = (settings.public_base_url or "").strip()
    if not raw.lower().startswith("https://"):
        return False

    host = (urlparse(raw).hostname or "").lower()
    if not host or host in {"localhost", "127.0.0.1", "::1"}:
        return False
    if host == "example.com" or host.endswith(".example.com"):
        return False
    return True


def session_cookie_kwargs(*, max_age: int) -> dict:
    return {
        "key": SESSION_COOKIE,
        "httponly": True,
        "secure": cookie_secure(),
        "samesite": "lax",
        "max_age": max_age,
        "path": "/",
    }


def csrf_cookie_kwargs(*, max_age: int) -> dict:
    return {
        "key": CSRF_COOKIE,
        "httponly": False,
        "secure": cookie_secure(),
        "samesite": "lax",
        "max_age": max_age,
        "path": "/",
    }
