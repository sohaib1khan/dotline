"""User settings and account schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ThemeName = Literal["high_contrast_dark", "high_contrast_light", "yellow_on_black"]
Handedness = Literal["left", "right"]


class UserSettingsPublic(BaseModel):
    text_scale: int
    theme: ThemeName
    reduce_motion: bool
    reduced_visuals: bool
    volume: float
    speech_rate: float
    speech_enabled: bool
    haptics_enabled: bool
    haptics_intensity: float
    handedness: Handedness
    gamepad_mapping: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    text_scale: int | None = Field(default=None, ge=100, le=300)
    theme: ThemeName | None = None
    reduce_motion: bool | None = None
    reduced_visuals: bool | None = None
    volume: float | None = Field(default=None, ge=0, le=1)
    speech_rate: float | None = Field(default=None, ge=0.5, le=2)
    speech_enabled: bool | None = None
    haptics_enabled: bool | None = None
    haptics_intensity: float | None = Field(default=None, ge=0, le=1)
    handedness: Handedness | None = None
    gamepad_mapping: dict[str, Any] | None = None


class AccountUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=24)
    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    new_password: str | None = Field(default=None, min_length=12, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=12, max_length=128)
