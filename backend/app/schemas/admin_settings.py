"""Admin settings schemas."""

from pydantic import BaseModel, EmailStr, Field


class EmailSettingsResponse(BaseModel):
    configured: bool
    has_api_key: bool
    api_key_masked: str | None
    from_name: str
    from_email: str
    signups_open: bool


class EmailSettingsUpdateRequest(BaseModel):
    from_name: str = Field(min_length=1, max_length=100)
    from_email: EmailStr
    api_key: str | None = Field(default=None, min_length=8, max_length=200)
    replace_api_key: bool = False


class TestEmailResponse(BaseModel):
    ok: bool
    message: str
