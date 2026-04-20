"""Add calendar export preferences to users

Revision ID: 038
Revises: 037
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ical_include_events", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("users", sa.Column("ical_include_tasks", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("users", sa.Column("ical_include_journal", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("ical_include_field_dates", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("users", "ical_include_field_dates")
    op.drop_column("users", "ical_include_journal")
    op.drop_column("users", "ical_include_tasks")
    op.drop_column("users", "ical_include_events")
