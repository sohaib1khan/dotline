"""Lesson content models (units and lessons)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    track: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    lessons: Mapped[list[Lesson]] = relationship(back_populates="unit", order_by="Lesson.order")

    __table_args__ = (UniqueConstraint("track", "order", name="uq_units_track_order"),)


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    unit: Mapped[Unit] = relationship(back_populates="lessons")

    __table_args__ = (UniqueConstraint("unit_id", "order", name="uq_lessons_unit_order"),)
