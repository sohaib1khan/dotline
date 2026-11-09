"""First-run admin setup endpoints. Permanently 404 after an admin exists."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.setup import SetupCreateAdminRequest, SetupCreateAdminResponse, SetupStatusResponse
from app.services.setup import admin_exists, create_first_admin

router = APIRouter(prefix="/api/setup", tags=["setup"])


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    # After first admin exists, the entire setup API permanently 404s.
    if admin_exists(db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return SetupStatusResponse(needs_setup=True)


@router.post("/admin", response_model=SetupCreateAdminResponse)
def setup_admin(
    payload: SetupCreateAdminRequest,
    db: Session = Depends(get_db),
) -> SetupCreateAdminResponse:
    if admin_exists(db, use_cache=False):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    create_first_admin(db, payload)
    return SetupCreateAdminResponse(ok=True, redirect_to="/admin/settings/email")
