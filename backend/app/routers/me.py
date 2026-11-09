"""Current-user settings and account endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse, UserPublic
from app.schemas.settings import AccountUpdateRequest, UserSettingsPublic, UserSettingsUpdate
from app.security.deps import get_current_user, require_csrf
from app.services import user_settings as settings_service

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/settings", response_model=UserSettingsPublic)
def get_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserSettingsPublic:
    return UserSettingsPublic.model_validate(settings_service.get_or_create_settings(db, user))


@router.patch("/settings", response_model=UserSettingsPublic, dependencies=[Depends(require_csrf)])
def patch_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserSettingsPublic:
    return UserSettingsPublic.model_validate(settings_service.update_settings(db, user, payload))


@router.patch("/account", response_model=UserPublic, dependencies=[Depends(require_csrf)])
def patch_account(
    payload: AccountUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPublic:
    updated = settings_service.update_account(db, user, payload)
    return UserPublic.model_validate(updated)


@router.get("/account", response_model=UserPublic)
def get_account(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)
