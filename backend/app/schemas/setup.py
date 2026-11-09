"""Schemas for first-run admin setup."""

from pydantic import BaseModel, EmailStr, Field, model_validator


class SetupStatusResponse(BaseModel):
    needs_setup: bool


class SetupCreateAdminRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=50)
    last_name: str = Field(min_length=2, max_length=50)
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    confirm_password: str = Field(min_length=12, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "SetupCreateAdminRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class SetupCreateAdminResponse(BaseModel):
    ok: bool
    redirect_to: str = "/admin/settings/email"
