"""Add note_fields table with FTS support

Revision ID: 028
Revises: 027
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '028'
down_revision: Union[str, None] = '027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'note_fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('note_id', sa.Integer(), nullable=False),
        sa.Column('group_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('key', sa.String(500), nullable=False),
        sa.Column('value', sa.Text(), nullable=False, server_default=''),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fts_vector', postgresql.TSVECTOR(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_note_fields_id', 'note_fields', ['id'])
    op.create_index('ix_note_fields_note_id', 'note_fields', ['note_id'])
    op.create_index(
        'ix_note_fields_fts_vector', 'note_fields', ['fts_vector'],
        postgresql_using='gin',
    )

    # FTS trigger: group_name(A), key(B), value(C) — uses 'simple' dictionary
    # so partial token matching works regardless of language
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
        CREATE TRIGGER note_fields_fts_update
        BEFORE INSERT OR UPDATE ON note_fields
        FOR EACH ROW EXECUTE FUNCTION note_fields_fts_trigger_func();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS note_fields_fts_update ON note_fields")
    op.execute("DROP FUNCTION IF EXISTS note_fields_fts_trigger_func()")
    op.drop_table('note_fields')
