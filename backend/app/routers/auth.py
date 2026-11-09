"""Login, logout, signup, verify, and password reset routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.auth import (
    CsrfResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    SignupResponse,
    UserPublic,
    VerifyEmailRequest,
)
from app.security.cookies import SESSION_COOKIE, csrf_cookie_kwargs, session_cookie_kwargs
from app.security.csrf import issue_csrf_token
from app.security.deps import client_ip, get_current_user, get_optional_user, require_csrf
from app.security.rate_limit import limiter
from app.security.sessions import SESSION_TTL, create_session, revoke_session_token
from app.services import app_settings as settings_service
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(value=raw_token, **session_cookie_kwargs(max_age=int(SESSION_TTL.total_seconds())))


def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(value=token, **csrf_cookie_kwargs(max_age=int(SESSION_TTL.total_seconds())))


@router.get("/csrf", response_model=CsrfResponse)
def get_csrf(response: Response) -> CsrfResponse:
    token = issue_csrf_token()
    _set_csrf_cookie(response, token)
    return CsrfResponse(csrf_token=token)


@router.get("/me", response_model=MeResponse)
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        user=UserPublic.model_validate(user),
        email_configured=settings_service.email_is_configured(db),
        signups_open=settings_service.signups_open(db),
    )


@router.get("/signup-status")
def signup_status(db: Session = Depends(get_db)) -> dict:
    open_ = settings_service.signups_open(db)
    mode = settings_service.signup_gate_mode(db)
    if not open_:
        message = "Sign-ups are temporarily closed."
    elif mode == "admin":
        message = "Sign-ups are open. After you create an account, an admin must approve it before you can log in."
    elif mode == "email":
        message = "Sign-ups are open. You will confirm your email to finish creating your account."
    else:
        message = "Sign-ups are open. You can log in right after creating your account."
    return {
        "signups_open": open_,
        "email_configured": settings_service.email_is_configured(db),
        "gate_mode": mode,
        "message": message,
    }


@router.post("/login", response_model=MeResponse, dependencies=[Depends(require_csrf)])
@limiter.limit("30/minute")
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> MeResponse:
    user = auth_service.authenticate_user(
        db,
        login=payload.login,
        password=payload.password,
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    _, raw = create_session(
        db,
        user,
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    _set_session_cookie(response, raw)
    _set_csrf_cookie(response, issue_csrf_token())
    return MeResponse(
        user=UserPublic.model_validate(user),
        email_configured=settings_service.email_is_configured(db),
        signups_open=settings_service.signups_open(db),
    )


@router.post("/logout", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> MessageResponse:
    revoke_session_token(db, request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/")
    return MessageResponse(message="Logged out")


@router.post("/signup", response_model=SignupResponse, dependencies=[Depends(require_csrf)])
@limiter.limit("10/minute")
def signup(request: Request, payload: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    user, verification_required = auth_service.register_learner(
        db,
        first_name=payload.first_name,
        last_name=payload.last_name,
        username=payload.username,
        email=str(payload.email),
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    if verification_required:
        return SignupResponse(
            message="Account created. Check your email to confirm and start learning.",
            verification_required=True,
            pending_approval=False,
        )
    if user.role == "admin":
        return SignupResponse(
            message="Admin account created. Log in to open the admin console.",
            verification_required=False,
            pending_approval=False,
        )
    if not user.is_active:
        return SignupResponse(
            message="Account created. An admin must approve it before you can log in.",
            verification_required=False,
            pending_approval=True,
        )
    return SignupResponse(
        message="Account created. You can log in now.",
        verification_required=False,
        pending_approval=False,
    )


@router.post("/verify-email", response_model=MeResponse, dependencies=[Depends(require_csrf)])
def verify_email(
    request: Request,
    payload: VerifyEmailRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> MeResponse:
    user = auth_service.verify_email_token(db, payload.token)
    _, raw = create_session(
        db,
        user,
        ip=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    _set_session_cookie(response, raw)
    _set_csrf_cookie(response, issue_csrf_token())
    return MeResponse(
        user=UserPublic.model_validate(user),
        email_configured=settings_service.email_is_configured(db),
        signups_open=settings_service.signups_open(db),
    )


@router.post("/resend-verification", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
@limiter.limit("5/minute")
def resend_verification(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    if user.email_verified_at is not None:
        return MessageResponse(message="Email is already verified.")
    auth_service.send_verification_email(db, user)
    return MessageResponse(message="Verification email sent.")


@router.post("/forgot-password", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    auth_service.request_password_reset(db, str(payload.email))
    return MessageResponse(message="If that email exists, a reset link is on the way.")


@router.post("/reset-password", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    auth_service.reset_password(
        db,
        raw_token=payload.token,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    return MessageResponse(message="Password updated. You can log in now.")


@router.get("/session-check")
def session_check(user: User | None = Depends(get_optional_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return {
        "authenticated": True,
        "role": user.role,
        "email_verified": user.email_verified_at is not None,
    }
