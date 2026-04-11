"""Add calendar_token to users

Revision ID: 025
Revises: 024
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("calendar_token", sa.String(64), nullable=True, unique=True),
    )
    op.create_index("ix_users_calendar_token", "users", ["calendar_token"], unique=True)


def downgrade():
    op.drop_index("ix_users_calendar_token", table_name="users")
    op.drop_column("users", "calendar_token")
