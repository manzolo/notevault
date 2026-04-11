"""Add recurrence_rule to events

Revision ID: 024
Revises: 023
Create Date: 2026-04-11
"""
import sqlalchemy as sa
from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("events", sa.Column("recurrence_rule", sa.Text, nullable=True))


def downgrade():
    op.drop_column("events", "recurrence_rule")
