"""Add signature practice table.

Revision ID: 20260309_0004
Revises: 20260309_0003
Create Date: 2026-03-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260309_0004"
down_revision: Union[str, None] = "20260309_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "signature_practices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name_text", sa.String(length=120), nullable=False),
        sa.Column("strokes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_signature_practices_user_id", "signature_practices", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_signature_practices_user_id", table_name="signature_practices")
    op.drop_table("signature_practices")
