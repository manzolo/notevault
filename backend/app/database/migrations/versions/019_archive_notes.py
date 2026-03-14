"""archive notes

Revision ID: 019
Revises: 018
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notes', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('notes', 'is_archived')
