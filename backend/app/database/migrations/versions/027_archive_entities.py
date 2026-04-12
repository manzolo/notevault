"""Add is_archived and archive_note to secrets, bookmarks, tasks, events, attachments

Revision ID: 027
Revises: 026
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = '027'
down_revision: Union[str, None] = '026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['secrets', 'bookmarks', 'tasks', 'events', 'attachments']


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :i"
    ), {"i": index_name})
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    for table in TABLES:
        if not _column_exists(conn, table, 'is_archived'):
            op.add_column(table, sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
        if not _column_exists(conn, table, 'archive_note'):
            op.add_column(table, sa.Column('archive_note', sa.Text(), nullable=True))
        idx = f'ix_{table}_is_archived'
        if not _index_exists(conn, idx):
            op.create_index(idx, table, ['is_archived'])


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f'ix_{table}_is_archived', table_name=table)
        op.drop_column(table, 'archive_note')
        op.drop_column(table, 'is_archived')
