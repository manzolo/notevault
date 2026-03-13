"""Add totp_seed value to secrettype enum

Revision ID: 012
Revises: 011
Create Date: 2026-03-13
"""
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE secrettype ADD VALUE IF NOT EXISTS 'totp_seed'")


def downgrade():
    # PostgreSQL does not support removing enum values — no-op
    pass
