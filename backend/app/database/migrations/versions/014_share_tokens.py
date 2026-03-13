"""share tokens

Revision ID: 014
Revises: 013
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'share_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('note_id', sa.Integer(), sa.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_share_tokens_token', 'share_tokens', ['token'])
    op.create_index('ix_share_tokens_note_id', 'share_tokens', ['note_id'])


def downgrade():
    op.drop_table('share_tokens')
