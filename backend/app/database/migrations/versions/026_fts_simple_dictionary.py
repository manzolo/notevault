"""Switch FTS triggers from 'english' to 'simple' dictionary for multilingual support

Revision ID: 026
Revises: 025
Create Date: 2026-04-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '026'
down_revision: Union[str, None] = '025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Notes trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION notes_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'B');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)

    # Attachments trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION attachments_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.filename, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.extracted_text, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)

    # Bookmarks trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION bookmarks_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.url, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)

    # Rebuild fts_vector for all existing rows
    op.execute("""
        UPDATE notes SET fts_vector =
            setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(content, '')), 'B');
    """)
    op.execute("""
        UPDATE attachments SET fts_vector =
            setweight(to_tsvector('simple', coalesce(filename, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(extracted_text, '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(description, '')), 'C');
    """)
    op.execute("""
        UPDATE bookmarks SET fts_vector =
            setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(url, '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(description, '')), 'C');
    """)


def downgrade() -> None:
    # Restore 'english' triggers
    op.execute("""
        CREATE OR REPLACE FUNCTION notes_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
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
    op.execute("""
        CREATE OR REPLACE FUNCTION bookmarks_fts_trigger_func()
        RETURNS trigger AS $$
        BEGIN
            NEW.fts_vector :=
                setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.url, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        UPDATE notes SET fts_vector =
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(content, '')), 'B');
    """)
    op.execute("""
        UPDATE attachments SET fts_vector =
            setweight(to_tsvector('english', coalesce(filename, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(extracted_text, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'C');
    """)
    op.execute("""
        UPDATE bookmarks SET fts_vector =
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(url, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'C');
    """)
