"""Block app routes until the first admin has been created."""

from __future__ import annotations

from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response

from app.db import SessionLocal
from app.services import setup as setup_service

_ALLOWED_PREFIXES = (
    "/api/setup",
    "/api/health",
    "/assets/",
)
_ALLOWED_EXACT = {
    "/favicon.ico",
    "/manifest.webmanifest",
    "/robots.txt",
}


class SetupGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        if path in _ALLOWED_EXACT or any(path.startswith(prefix) for prefix in _ALLOWED_PREFIXES):
            return await call_next(request)

        # Fast path once first admin has been created.
        if setup_service.admin_known_to_exist():
            return await call_next(request)

        db = SessionLocal()
        try:
            needs_setup = not setup_service.admin_exists(db)
        finally:
            db.close()

        if not needs_setup:
            return await call_next(request)

        if path.startswith("/api/"):
            return JSONResponse(
                status_code=503,
                content={"detail": "Setup required", "code": "setup_required"},
            )

        if path != "/setup":
            return RedirectResponse(url="/setup", status_code=307)

        return await call_next(request)
