"""FastAPI application factory and static frontend serving."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.db import SessionLocal
from app.middleware.setup_gate import SetupGateMiddleware
from app.routers import admin_debug as admin_debug_router
from app.routers import admin_settings as admin_settings_router
from app.routers import auth as auth_router
from app.routers import bootstrap as bootstrap_router
from app.routers import lessons as lessons_router
from app.routers import me as me_router
from app.routers import setup as setup_router
from app.routers import statusboard as statusboard_router
from app.routers import tracks as tracks_router
from app.security.rate_limit import limiter
from app.services import badges as badge_service
from app.services import content_seed

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


def create_app() -> FastAPI:
    app = FastAPI(title="Dotline", version="0.1.0")
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(SetupGateMiddleware)

    app.include_router(bootstrap_router.router)
    app.include_router(setup_router.router)
    app.include_router(auth_router.router)
    app.include_router(me_router.router)
    app.include_router(tracks_router.router)
    app.include_router(statusboard_router.router)
    app.include_router(lessons_router.router)
    app.include_router(admin_settings_router.router)
    app.include_router(admin_debug_router.router)

    @app.on_event("startup")
    def seed_reference_data() -> None:
        db = SessionLocal()
        try:
            badge_service.seed_badges(db)
            content_seed.seed_all_content(db)
        finally:
            db.close()

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "app": "dotline"}

    if STATIC_DIR.is_dir():
        assets_dir = STATIC_DIR / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}", response_model=None)
        def spa_fallback(full_path: str) -> Response:
            candidate = STATIC_DIR / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            index = STATIC_DIR / "index.html"
            if index.is_file():
                return FileResponse(index)
            return JSONResponse({"detail": "Frontend not built"}, status_code=404)

    return app


app = create_app()
