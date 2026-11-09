"""Auth request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=50)
    last_name: str = Field(min_length=2, max_length=50)
    username: str = Field(min_length=3, max_length=24)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    confirm_password: str = Field(min_length=12, max_length=128)


class MessageResponse(BaseModel):
    ok: bool = True
    message: str


class UserPublic(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    role: str
    email_verified_at: datetime | None
    is_active: bool

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserPublic
    email_configured: bool
    signups_open: bool


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=12, max_length=128)
    confirm_password: str = Field(min_length=12, max_length=128)


class CsrfResponse(BaseModel):
    csrf_token: str
