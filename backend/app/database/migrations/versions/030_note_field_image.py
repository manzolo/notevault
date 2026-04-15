"""Add field_image to note_fields

Revision ID: 030
Revises: 029
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '030'
down_revision: Union[str, None] = '029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE note_fields ADD COLUMN IF NOT EXISTS field_image TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE note_fields DROP COLUMN IF EXISTS field_image")
