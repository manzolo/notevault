"""Add fts_vector to events table

Revision ID: 031
Revises: 030
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '031'
down_revision: Union[str, None] = '030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_events_fts_vector ON events USING gin (fts_vector)"
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION events_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE OR REPLACE TRIGGER events_fts_update
        BEFORE INSERT OR UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION events_fts_trigger_func();
    """)

    # Backfill existing rows
    op.execute("""
        UPDATE events SET fts_vector =
            setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS events_fts_update ON events")
    op.execute("DROP FUNCTION IF EXISTS events_fts_trigger_func()")
    op.execute("DROP INDEX IF EXISTS ix_events_fts_vector")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS fts_vector")
