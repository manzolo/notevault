"""add position to secrets

Revision ID: 022
Revises: 021
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('secrets', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.execute("""
        UPDATE secrets s SET position = sub.rn - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY created_at) AS rn
            FROM secrets
        ) sub
        WHERE s.id = sub.id
    """)


def downgrade():
    op.drop_column('secrets', 'position')
