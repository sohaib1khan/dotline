"""Public bootstrap info for first paint routing."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.setup import admin_exists

router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Always available: tells the UI whether first-run setup is required."""
    return {"needs_setup": not admin_exists(db)}
