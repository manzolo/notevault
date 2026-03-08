"""Add attachments

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Attachments table
    op.create_table(
        'attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('note_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('stored_filename', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('fts_vector', postgresql.TSVECTOR(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_attachments_id', 'attachments', ['id'])
    op.create_index('ix_attachments_note_id', 'attachments', ['note_id'])
    op.create_index('ix_attachments_fts_vector', 'attachments', ['fts_vector'], postgresql_using='gin')

    # FTS trigger for attachments
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
    op.execute("""
        CREATE TRIGGER attachments_fts_update
        BEFORE INSERT OR UPDATE ON attachments
        FOR EACH ROW EXECUTE FUNCTION attachments_fts_trigger_func();
    """)

    # AttachmentTags junction table
    op.create_table(
        'attachment_tags',
        sa.Column('attachment_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['attachment_id'], ['attachments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('attachment_id', 'tag_id'),
    )


def downgrade() -> None:
    op.drop_table('attachment_tags')
    op.execute("DROP TRIGGER IF EXISTS attachments_fts_update ON attachments")
    op.execute("DROP FUNCTION IF EXISTS attachments_fts_trigger_func()")
    op.drop_table('attachments')
