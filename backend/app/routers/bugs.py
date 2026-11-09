"""Bug report learner + admin routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.bugs import BugCreateRequest, BugPublic, BugReplyRequest
from app.security.deps import get_current_user, require_admin, require_csrf
from app.security.rate_limit import limiter
from app.services import bugs as bugs_service

router = APIRouter(tags=["bugs"])


@router.get("/api/bugs/categories")
def categories(_: User = Depends(get_current_user)) -> dict:
    return {
        "categories": [
            {"id": key, "label": bugs_service.CATEGORY_LABELS[key]}
            for key in bugs_service.BUG_CATEGORIES
        ]
    }


@router.post("/api/bugs", response_model=BugPublic, dependencies=[Depends(require_csrf)])
@limiter.limit("10/hour")
def create_bug(
    request: Request,
    payload: BugCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BugPublic:
    row = bugs_service.create_report(
        db,
        user,
        category=payload.category,
        description=payload.description,
        context=payload.context,
    )
    return BugPublic(**bugs_service.report_public(row))


@router.get("/api/bugs/mine", response_model=list[BugPublic])
def my_bugs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[BugPublic]:
    return [BugPublic(**bugs_service.report_public(row)) for row in bugs_service.list_user_reports(db, user.id)]


@router.get("/api/admin/bugs", response_model=list[BugPublic])
def admin_list_bugs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[BugPublic]:
    return [
        BugPublic(**bugs_service.report_public(row, include_context=True))
        for row in bugs_service.list_all_reports(db)
    ]


@router.get("/api/admin/bugs/{report_id}", response_model=BugPublic)
def admin_get_bug(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> BugPublic:
    row = bugs_service.get_report(db, report_id)
    return BugPublic(**bugs_service.report_public(row, include_context=True))


@router.post(
    "/api/admin/bugs/{report_id}/reply",
    response_model=BugPublic,
    dependencies=[Depends(require_csrf)],
)
def admin_reply(
    report_id: uuid.UUID,
    payload: BugReplyRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BugPublic:
    row = bugs_service.reply_to_report(
        db,
        admin,
        report_id=report_id,
        reply=payload.reply,
        status_value=payload.status,
    )
    return BugPublic(**bugs_service.report_public(row, include_context=True))
