"""Add note_fields table with FTS support

Revision ID: 028
Revises: 027
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '028'
down_revision: Union[str, None] = '027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS note_fields (
            id          SERIAL NOT NULL,
            note_id     INTEGER NOT NULL,
            group_name  VARCHAR(200) NOT NULL DEFAULT '',
            key         VARCHAR(500) NOT NULL,
            value       TEXT NOT NULL DEFAULT '',
            position    INTEGER NOT NULL DEFAULT 0,
            fts_vector  TSVECTOR,
            created_at  TIMESTAMPTZ DEFAULT now(),
            updated_at  TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT note_fields_note_id_fkey
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_note_fields_id ON note_fields (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_note_fields_note_id ON note_fields (note_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_note_fields_fts_vector ON note_fields USING gin (fts_vector)"
    )

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
    op.execute("""
        CREATE OR REPLACE TRIGGER note_fields_fts_update
        BEFORE INSERT OR UPDATE ON note_fields
        FOR EACH ROW EXECUTE FUNCTION note_fields_fts_trigger_func();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS note_fields_fts_update ON note_fields")
    op.execute("DROP FUNCTION IF EXISTS note_fields_fts_trigger_func()")
    op.execute("DROP TABLE IF EXISTS note_fields")
