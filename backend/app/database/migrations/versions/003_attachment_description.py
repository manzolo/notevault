"""Add description to attachments

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('attachments', sa.Column('description', sa.Text(), nullable=True))

    # Update FTS trigger to 3 weights: filename(A), extracted_text(B), description(C)
    op.execute("""
        CREATE OR REPLACE FUNCTION attachments_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('english', coalesce(NEW.filename, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.extracted_text, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)

    # Re-index existing rows to pick up the new trigger definition
    op.execute("UPDATE attachments SET description = description")


def downgrade() -> None:
    # Revert trigger to 2 weights
    op.execute("""
        CREATE OR REPLACE FUNCTION attachments_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('english', coalesce(NEW.filename, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.extracted_text, '')), 'B');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.drop_column('attachments', 'description')
