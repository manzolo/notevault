"""Add file_modified_at column to attachments

Revision ID: 010
Revises: 009
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("attachments", sa.Column("file_modified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("attachments", "file_modified_at")
