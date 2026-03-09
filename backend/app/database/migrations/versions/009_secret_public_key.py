"""Add public_key column to secrets (plain text, for SSH key pairs)

Revision ID: 009
Revises: 008
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("secrets", sa.Column("public_key", sa.Text, nullable=True))


def downgrade():
    op.drop_column("secrets", "public_key")
