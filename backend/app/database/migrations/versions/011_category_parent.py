"""Add parent_id and updated_at to categories; relax unique constraint to per-level

Revision ID: 011
Revises: 010
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("categories", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_categories_parent_id",
        "categories",
        "categories",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "categories",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )
    # Replace global (name, user_id) unique with per-level (name, user_id, parent_id)
    op.drop_constraint("uq_category_name_user", "categories", type_="unique")
    op.create_unique_constraint(
        "uq_category_name_user_parent",
        "categories",
        ["name", "user_id", "parent_id"],
    )


def downgrade():
    op.drop_constraint("uq_category_name_user_parent", "categories", type_="unique")
    op.create_unique_constraint("uq_category_name_user", "categories", ["name", "user_id"])
    op.drop_constraint("fk_categories_parent_id", "categories", type_="foreignkey")
    op.drop_column("categories", "parent_id")
    op.drop_column("categories", "updated_at")
