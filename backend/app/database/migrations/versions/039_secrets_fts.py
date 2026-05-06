"""Add FTS vector to secrets table

Revision ID: 039
Revises: 038
Create Date: 2026-05-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("secrets", sa.Column("fts_vector", TSVECTOR, nullable=True))

    op.execute("""
        CREATE INDEX ix_secrets_fts_vector ON secrets USING GIN (fts_vector)
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION secrets_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.username, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.url, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER secrets_fts_update
        BEFORE INSERT OR UPDATE ON secrets
        FOR EACH ROW EXECUTE FUNCTION secrets_fts_trigger_func()
    """)

    op.execute("""
        UPDATE secrets SET
            fts_vector =
                setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(username, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(url, '')), 'C')
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS secrets_fts_update ON secrets")
    op.execute("DROP FUNCTION IF EXISTS secrets_fts_trigger_func()")
    op.execute("DROP INDEX IF EXISTS ix_secrets_fts_vector")
    op.drop_column("secrets", "fts_vector")
