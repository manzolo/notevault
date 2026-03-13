"""015 share sections

Revision ID: 015
Revises: 014
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'share_tokens',
        sa.Column(
            'share_sections',
            postgresql.JSON(),
            nullable=False,
            server_default='{"content":true,"tasks":false,"attachments":false,"bookmarks":false,"secrets":false}',
        ),
    )


def downgrade():
    op.drop_column('share_tokens', 'share_sections')
