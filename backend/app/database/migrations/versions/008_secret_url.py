"""Add url column to secrets

Revision ID: 008
Revises: 007
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("secrets", sa.Column("url", sa.String(2048), nullable=True))


def downgrade():
    op.drop_column("secrets", "url")
