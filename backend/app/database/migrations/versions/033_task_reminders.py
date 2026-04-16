"""Add task_reminders table and task_id to notifications

Revision ID: 033
Revises: 032
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '033'
down_revision: Union[str, None] = '032'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS task_reminders (
            id SERIAL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            minutes_before INTEGER NOT NULL,
            notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
            notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
            notify_email BOOLEAN NOT NULL DEFAULT FALSE,
            notified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_reminders_task_id ON task_reminders(task_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_reminders_user_id ON task_reminders(user_id)")

    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_task_id ON notifications(task_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_notifications_task_id")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS task_id")
    op.execute("DROP TABLE IF EXISTS task_reminders")
