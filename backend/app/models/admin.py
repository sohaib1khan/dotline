"""Admin dashboard layout persistence."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AdminDashboardLayout(Base):
    __tablename__ = "admin_dashboard_layouts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    layout: Mapped[list[Any] | dict[str, Any]] = mapped_column(JSONB, nullable=False, default=list)
