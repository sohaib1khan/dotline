"""Admin monitoring dashboard and login log routes."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.monitoring import LayoutResponse, LayoutSaveRequest, LoginSearchResponse
from app.security.deps import require_admin, require_csrf
from app.services import activity as activity_service
from app.services import monitoring as monitoring_service

router = APIRouter(prefix="/api/admin", tags=["admin-monitoring"])


@router.get("/monitoring")
def get_monitoring(
    top_days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    return monitoring_service.build_dashboard(db, top_range_days=top_days)


@router.get("/monitoring/layout", response_model=LayoutResponse)
def get_layout(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> LayoutResponse:
    return LayoutResponse(layout=monitoring_service.get_layout(db, admin.id))


@router.put("/monitoring/layout", response_model=LayoutResponse, dependencies=[Depends(require_csrf)])
def put_layout(
    payload: LayoutSaveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> LayoutResponse:
    return LayoutResponse(layout=monitoring_service.save_layout(db, admin.id, payload.layout))


@router.post(
    "/monitoring/layout/reset",
    response_model=LayoutResponse,
    dependencies=[Depends(require_csrf)],
)
def reset_layout(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> LayoutResponse:
    return LayoutResponse(layout=monitoring_service.reset_layout(db, admin.id))


@router.post("/monitoring/rollup", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
def rollup(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    result = activity_service.rollup_sessions(db)
    return MessageResponse(message=f"Rollup created {result['created_rows']} daily rows.")


@router.get("/login-events", response_model=LoginSearchResponse)
def login_events(
    q: str | None = Query(default=None, max_length=120),
    success: Literal["all", "success", "fail"] = Query(default="all"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LoginSearchResponse:
    return LoginSearchResponse(
        **monitoring_service.search_login_events(
            db,
            q=q,
            success=success,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    )
