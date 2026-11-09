"""User account, settings, and track enrollment models."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    LEARNER = "learner"


class Track(str, enum.Enum):
    BRAILLE = "braille"
    CURSIVE = "cursive"


class Handedness(str, enum.Enum):
    LEFT = "left"
    RIGHT = "right"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    username: Mapped[str] = mapped_column(String(24), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=UserRole.LEARNER.value)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    settings: Mapped[UserSetting | None] = relationship(back_populates="user", uselist=False)
    tracks: Mapped[list[UserTrack]] = relationship(back_populates="user")

    __table_args__ = (
        UniqueConstraint("username", name="uq_users_username"),
        UniqueConstraint("email", name="uq_users_email"),
    )


class UserSetting(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    text_scale: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    theme: Mapped[str] = mapped_column(String(64), nullable=False, default="high_contrast_dark")
    reduce_motion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reduced_visuals: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    speech_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    speech_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    haptics_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    haptics_intensity: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    handedness: Mapped[str] = mapped_column(String(16), nullable=False, default=Handedness.RIGHT.value)
    gamepad_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped[User] = relationship(back_populates="settings")


class UserTrack(Base):
    __tablename__ = "user_tracks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    track: Mapped[str] = mapped_column(String(16), primary_key=True)
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="tracks")
