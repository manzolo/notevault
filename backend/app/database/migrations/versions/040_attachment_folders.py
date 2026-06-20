"""Add per-note attachment folders

Revision ID: 040
Revises: 039
Create Date: 2026-06-21

"""
from alembic import op
import sqlalchemy as sa

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attachment_folders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("note_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["attachment_folders.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("name", "note_id", "parent_id", name="uq_attachment_folder_name_note_parent"),
    )
    op.create_index("ix_attachment_folders_note_id", "attachment_folders", ["note_id"])

    op.add_column(
        "attachments",
        sa.Column("folder_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_attachments_folder_id",
        "attachments",
        "attachment_folders",
        ["folder_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_attachments_folder_id", "attachments", type_="foreignkey")
    op.drop_column("attachments", "folder_id")
    op.drop_index("ix_attachment_folders_note_id", table_name="attachment_folders")
    op.drop_table("attachment_folders")
