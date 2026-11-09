"""Admin user management routes."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.admin_users import (
    AdminResetProgressRequest,
    AdminUserDetail,
    AdminUserSummary,
    DeleteUserRequest,
    MessageOnly,
    SetActiveRequest,
    SetRoleRequest,
)
from app.schemas.auth import MessageResponse
from app.security.deps import require_admin, require_csrf
from app.services import admin_users as users_service

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("", response_model=list[AdminUserSummary])
def list_users(
    q: str | None = Query(default=None, max_length=100),
    role: str | None = Query(default=None),
    status_filter: Literal["active", "disabled", "all"] = Query(default="all", alias="status"),
    verified: Literal["yes", "no", "all"] = Query(default="all"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AdminUserSummary]:
    rows = users_service.search_users(
        db, q=q, role=role, status_filter=status_filter, verified=verified
    )
    return [AdminUserSummary(**row) for row in rows]


@router.get("/{user_id}", response_model=AdminUserDetail)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminUserDetail:
    return AdminUserDetail(**users_service.user_detail(db, user_id))


@router.post("/{user_id}/active", response_model=AdminUserSummary, dependencies=[Depends(require_csrf)])
def set_active(
    user_id: uuid.UUID,
    payload: SetActiveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserSummary:
    return AdminUserSummary(**users_service.set_active(db, admin, user_id, is_active=payload.is_active))


@router.post("/{user_id}/role", response_model=AdminUserSummary, dependencies=[Depends(require_csrf)])
def set_role(
    user_id: uuid.UUID,
    payload: SetRoleRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserSummary:
    return AdminUserSummary(**users_service.set_role(db, admin, user_id, role=payload.role))


@router.post(
    "/{user_id}/password-reset",
    response_model=MessageOnly,
    dependencies=[Depends(require_csrf)],
)
def password_reset(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageOnly:
    return MessageOnly(**users_service.send_password_reset(db, user_id))


@router.post(
    "/{user_id}/resend-verification",
    response_model=MessageOnly,
    dependencies=[Depends(require_csrf)],
)
def resend_verification(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageOnly:
    return MessageOnly(**users_service.resend_verification(db, user_id))


@router.post(
    "/{user_id}/reset-progress",
    response_model=MessageResponse,
    dependencies=[Depends(require_csrf)],
)
def reset_progress(
    user_id: uuid.UUID,
    payload: AdminResetProgressRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    result = users_service.reset_user_progress(
        db, user_id, scope=payload.scope, confirm=payload.confirm
    )
    return MessageResponse(message=f"Reset {result['scope']} for user.")


@router.post(
    "/{user_id}/delete",
    response_model=MessageOnly,
    dependencies=[Depends(require_csrf)],
)
def delete_user(
    user_id: uuid.UUID,
    payload: DeleteUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> MessageOnly:
    return MessageOnly(
        **users_service.delete_user(db, admin, user_id, confirm_username=payload.confirm_username)
    )
