"""Admin settings schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailSettingsResponse(BaseModel):
    configured: bool
    has_api_key: bool
    api_key_masked: str | None
    from_name: str
    from_email: str
    reply_to: str
    require_verification: bool
    public_base_url: str
    signups_open: bool


class EmailSettingsUpdateRequest(BaseModel):
    from_name: str = Field(min_length=1, max_length=100)
    from_email: EmailStr
    reply_to: str | None = Field(default=None, max_length=200)
    require_verification: bool = True
    public_base_url: str | None = Field(default=None, max_length=300)
    api_key: str | None = Field(default=None, min_length=8, max_length=200)
    replace_api_key: bool = False
    clear_api_key: bool = False

    @field_validator("reply_to")
    @classmethod
    def empty_reply_to(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("public_base_url")
    @classmethod
    def clean_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().rstrip("/")
        return cleaned or None


class TestEmailResponse(BaseModel):
    ok: bool
    message: str


class SignupsSettingsResponse(BaseModel):
    signups_open: bool


class SignupsSettingsUpdateRequest(BaseModel):
    signups_open: bool


class GeneralSettingsResponse(BaseModel):
    app_name: str
    default_daily_goal_minutes: int
    support_email: str
    public_base_url: str
    welcome_message: str
    signups_open: bool


class GeneralSettingsUpdateRequest(BaseModel):
    app_name: str = Field(min_length=1, max_length=80)
    default_daily_goal_minutes: int = Field(ge=1, le=180)
    support_email: str | None = Field(default=None, max_length=200)
    public_base_url: str | None = Field(default=None, max_length=300)
    welcome_message: str | None = Field(default=None, max_length=500)

    @field_validator("support_email")
    @classmethod
    def clean_support(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("public_base_url")
    @classmethod
    def clean_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().rstrip("/")
        return cleaned or None

    @field_validator("welcome_message")
    @classmethod
    def clean_welcome(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None
