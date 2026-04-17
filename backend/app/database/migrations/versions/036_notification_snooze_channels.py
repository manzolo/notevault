"""Add notify_telegram, notify_email, snooze_dispatched to notifications

Revision ID: 036
Revises: 035
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("notify_telegram", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("notifications", sa.Column("notify_email", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("notifications", sa.Column("snooze_dispatched", sa.Boolean(), nullable=False, server_default="true"))


def downgrade() -> None:
    op.drop_column("notifications", "snooze_dispatched")
    op.drop_column("notifications", "notify_email")
    op.drop_column("notifications", "notify_telegram")
