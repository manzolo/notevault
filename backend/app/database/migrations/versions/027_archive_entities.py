"""Add is_archived and archive_note to secrets, bookmarks, tasks, events, attachments

Revision ID: 027
Revises: 026
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = '027'
down_revision: Union[str, None] = '026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['secrets', 'bookmarks', 'tasks', 'events', 'attachments']


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
        op.add_column(table, sa.Column('archive_note', sa.Text(), nullable=True))
        op.create_index(f'ix_{table}_is_archived', table, ['is_archived'])


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f'ix_{table}_is_archived', table_name=table)
        op.drop_column(table, 'archive_note')
        op.drop_column(table, 'is_archived')
