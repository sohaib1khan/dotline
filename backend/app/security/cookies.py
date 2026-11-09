"""Cookie policy helpers for session and CSRF cookies."""

from app.config import get_settings

SESSION_COOKIE = "dotline_session"
CSRF_COOKIE = "dotline_csrf"


def cookie_secure() -> bool:
    settings = get_settings()
    if settings.app_env == "development":
        return False
    return settings.public_base_url.startswith("https://")


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
