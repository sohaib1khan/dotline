"""Public bootstrap info for first paint routing."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services import app_settings as settings_service
from app.services.setup import admin_exists

router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Always available: tells the UI whether first-run setup is required."""
    return {"needs_setup": not admin_exists(db)}


@router.get("/public/site")
def public_site(db: Session = Depends(get_db)) -> dict[str, str]:
    """Non-secret site copy for learners (welcome line, app name)."""
    general = settings_service.general_settings_public(db)
    return {
        "app_name": str(general["app_name"]),
        "welcome_message": str(general["welcome_message"]),
        "support_email": str(general.get("support_email") or ""),
    }
