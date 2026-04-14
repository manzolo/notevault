"""Add link, field_note, field_date, price to note_fields; update FTS trigger

Revision ID: 029
Revises: 028
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '029'
down_revision: Union[str, None] = '028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE note_fields ADD COLUMN IF NOT EXISTS link TEXT")
    op.execute("ALTER TABLE note_fields ADD COLUMN IF NOT EXISTS field_note TEXT")
    op.execute("ALTER TABLE note_fields ADD COLUMN IF NOT EXISTS field_date DATE")
    op.execute("ALTER TABLE note_fields ADD COLUMN IF NOT EXISTS price TEXT")

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_note_fields_field_date ON note_fields (field_date)"
    )

    # UPDATE FTS trigger to include field_note (weight D)
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
    op.execute("DROP INDEX IF EXISTS ix_note_fields_field_date")
    op.execute("ALTER TABLE note_fields DROP COLUMN IF EXISTS price")
    op.execute("ALTER TABLE note_fields DROP COLUMN IF EXISTS field_date")
    op.execute("ALTER TABLE note_fields DROP COLUMN IF EXISTS field_note")
    op.execute("ALTER TABLE note_fields DROP COLUMN IF EXISTS link")
