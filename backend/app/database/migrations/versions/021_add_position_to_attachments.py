"""add position to attachments

Revision ID: 021
Revises: 020
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('attachments', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.execute("""
        UPDATE attachments a SET position = sub.rn - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY created_at) AS rn
            FROM attachments
        ) sub
        WHERE a.id = sub.id
    """)


def downgrade():
    op.drop_column('attachments', 'position')
