"""018_share_visibility

Revision ID: 018
Revises: 017
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("share_tokens", sa.Column("visibility", sa.String(20), nullable=False, server_default="public"))
    op.add_column("share_tokens", sa.Column("allowed_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_share_tokens_allowed_user",
        "share_tokens",
        "users",
        ["allowed_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_share_tokens_allowed_user", "share_tokens", type_="foreignkey")
    op.drop_column("share_tokens", "allowed_user_id")
    op.drop_column("share_tokens", "visibility")
