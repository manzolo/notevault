"""add position to bookmarks

Revision ID: 020
Revises: 019
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bookmarks', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.execute("""
        UPDATE bookmarks b SET position = sub.rn - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY created_at) AS rn
            FROM bookmarks
        ) sub
        WHERE b.id = sub.id
    """)


def downgrade():
    op.drop_column('bookmarks', 'position')
