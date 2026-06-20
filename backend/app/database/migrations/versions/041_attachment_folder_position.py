"""Add manual ordering (position) to attachment folders

Revision ID: 041
Revises: 040
Create Date: 2026-06-21

"""
from alembic import op
import sqlalchemy as sa

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "attachment_folders",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("attachment_folders", "position")
