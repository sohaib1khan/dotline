"""Add sfx_enabled and speech_voice to user settings.

Revision ID: 20260309_0005
Revises: 20260309_0004
Create Date: 2026-03-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260309_0005"
down_revision: Union[str, None] = "20260309_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("sfx_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "user_settings",
        sa.Column("speech_voice", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "speech_voice")
    op.drop_column("user_settings", "sfx_enabled")
