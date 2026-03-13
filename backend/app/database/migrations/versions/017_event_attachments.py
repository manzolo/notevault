"""017_event_attachments

Revision ID: 017
Revises: 016
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "event_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_event_attachments_id"), "event_attachments", ["id"], unique=False)
    op.create_index(op.f("ix_event_attachments_event_id"), "event_attachments", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_attachments_user_id"), "event_attachments", ["user_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_event_attachments_user_id"), table_name="event_attachments")
    op.drop_index(op.f("ix_event_attachments_event_id"), table_name="event_attachments")
    op.drop_index(op.f("ix_event_attachments_id"), table_name="event_attachments")
    op.drop_table("event_attachments")
