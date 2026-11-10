"""Cookie policy helpers for session and CSRF cookies."""

from app.config import get_settings

SESSION_COOKIE = "dotline_session"
CSRF_COOKIE = "dotline_csrf"


def cookie_secure() -> bool:
    """Whether Set-Cookie should include Secure.

    Default is off so self-hosters can use http://LAN-IP:port before Nginx Proxy
    Manager. Turn on explicitly with COOKIE_SECURE=true once the public URL is HTTPS.
    Browsers drop Secure cookies on plain HTTP, which surfaces as "CSRF token missing".
    """
    settings = get_settings()
    if settings.cookie_secure is not None:
        return bool(settings.cookie_secure)
    return False


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
