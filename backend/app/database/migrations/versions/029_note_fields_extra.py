"""Add link, field_note, field_date, price to note_fields; update FTS trigger

Revision ID: 029
Revises: 028
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '029'
down_revision: Union[str, None] = '028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('note_fields', sa.Column('link', sa.Text(), nullable=True))
    op.add_column('note_fields', sa.Column('field_note', sa.Text(), nullable=True))
    op.add_column('note_fields', sa.Column('field_date', sa.Date(), nullable=True))
    op.add_column('note_fields', sa.Column('price', sa.Text(), nullable=True))

    op.create_index('ix_note_fields_field_date', 'note_fields', ['field_date'])

    # Update FTS trigger to include field_note (weight D)
    # CREATE OR REPLACE updates the function body in-place; trigger already points to it
    op.execute("""
        CREATE OR REPLACE FUNCTION note_fields_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.group_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.key, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.value, '')), 'C') ||
                setweight(to_tsvector('simple', coalesce(NEW.field_note, '')), 'D');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION note_fields_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.group_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.key, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.value, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.drop_index('ix_note_fields_field_date', table_name='note_fields')
    op.drop_column('note_fields', 'price')
    op.drop_column('note_fields', 'field_date')
    op.drop_column('note_fields', 'field_note')
    op.drop_column('note_fields', 'link')
