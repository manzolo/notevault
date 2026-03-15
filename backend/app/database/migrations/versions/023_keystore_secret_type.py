"""Add keystore value to secrettype enum

Revision ID: 023
Revises: 022
Create Date: 2026-03-16
"""
from alembic import op

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE secrettype ADD VALUE IF NOT EXISTS 'keystore'")


def downgrade():
    # PostgreSQL does not support removing enum values — no-op
    pass
