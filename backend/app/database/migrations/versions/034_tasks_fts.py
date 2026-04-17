"""Add fts_vector to tasks table

Revision ID: 034
Revises: 033
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '034'
down_revision: Union[str, None] = '033'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_fts_vector ON tasks USING gin (fts_vector)"
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION tasks_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE OR REPLACE TRIGGER tasks_fts_update
        BEFORE INSERT OR UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION tasks_fts_trigger_func();
    """)

    # Backfill existing rows
    op.execute("""
        UPDATE tasks SET fts_vector =
            setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tasks_fts_update ON tasks")
    op.execute("DROP FUNCTION IF EXISTS tasks_fts_trigger_func()")
    op.execute("DROP INDEX IF EXISTS ix_tasks_fts_vector")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS fts_vector")
