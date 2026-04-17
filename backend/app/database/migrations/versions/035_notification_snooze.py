"""Add snoozed_until to notifications table

Revision ID: 035
Revises: 034
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '035'
down_revision: Union[str, None] = '034'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'notifications',
        sa.Column('snoozed_until', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('notifications', 'snoozed_until')
