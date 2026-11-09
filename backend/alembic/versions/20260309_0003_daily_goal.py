"""Add daily goal minutes to user settings.

Revision ID: 20260309_0003
Revises: 20260309_0002
Create Date: 2026-03-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260309_0003"
down_revision: Union[str, None] = "20260309_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "daily_goal_minutes",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "daily_goal_minutes")
