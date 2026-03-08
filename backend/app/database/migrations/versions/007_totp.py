"""Add TOTP fields to users

Revision ID: 007
Revises: 006
Create Date: 2024-01-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('totp_secret', sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
