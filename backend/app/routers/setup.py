"""First-run admin setup endpoints. Permanently 404 after an admin exists."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.setup import SetupCreateAdminRequest, SetupCreateAdminResponse, SetupStatusResponse
from app.security.cookies import csrf_cookie_kwargs, session_cookie_kwargs
from app.security.csrf import issue_csrf_token
from app.security.deps import client_ip
from app.security.sessions import SESSION_TTL, create_session
from app.services.setup import admin_exists, create_first_admin

router = APIRouter(prefix="/api/setup", tags=["setup"])


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    if admin_exists(db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return SetupStatusResponse(needs_setup=True)


@router.post("/admin", response_model=SetupCreateAdminResponse)
def setup_admin(
    payload: SetupCreateAdminRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> SetupCreateAdminResponse:
    if admin_exists(db, use_cache=False):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    user = create_first_admin(db, payload)
    _, raw = create_session(
        db,
        user,
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    response.set_cookie(value=raw, **session_cookie_kwargs(max_age=int(SESSION_TTL.total_seconds())))
    csrf = issue_csrf_token()
    response.set_cookie(value=csrf, **csrf_cookie_kwargs(max_age=int(SESSION_TTL.total_seconds())))
    return SetupCreateAdminResponse(ok=True, redirect_to="/admin/settings/email")
