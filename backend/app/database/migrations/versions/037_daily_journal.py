"""Add journal_date to notes

Revision ID: 037
Revises: 036
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notes", sa.Column("journal_date", sa.Date(), nullable=True))
    op.create_unique_constraint("uq_note_user_journal_date", "notes", ["user_id", "journal_date"])
    op.create_index("ix_note_user_journal_date", "notes", ["user_id", "journal_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_note_user_journal_date", table_name="notes")
    op.drop_constraint("uq_note_user_journal_date", "notes", type_="unique")
    op.drop_column("notes", "journal_date")
