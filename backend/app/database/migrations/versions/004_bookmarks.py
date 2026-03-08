"""Add bookmarks

Revision ID: 004
Revises: 003
Create Date: 2024-01-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bookmarks table
    op.create_table(
        'bookmarks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('note_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('fts_vector', postgresql.TSVECTOR(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bookmarks_id', 'bookmarks', ['id'])
    op.create_index('ix_bookmarks_note_id', 'bookmarks', ['note_id'])
    op.create_index('ix_bookmarks_fts_vector', 'bookmarks', ['fts_vector'], postgresql_using='gin')

    # FTS trigger for bookmarks: title(A), url(B), description(C)
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
        CREATE TRIGGER bookmarks_fts_update
        BEFORE INSERT OR UPDATE ON bookmarks
        FOR EACH ROW EXECUTE FUNCTION bookmarks_fts_trigger_func();
    """)

    # BookmarkTags junction table
    op.create_table(
        'bookmark_tags',
        sa.Column('bookmark_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['bookmark_id'], ['bookmarks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('bookmark_id', 'tag_id'),
    )


def downgrade() -> None:
    op.drop_table('bookmark_tags')
    op.execute("DROP TRIGGER IF EXISTS bookmarks_fts_update ON bookmarks")
    op.execute("DROP FUNCTION IF EXISTS bookmarks_fts_trigger_func()")
    op.drop_table('bookmarks')
