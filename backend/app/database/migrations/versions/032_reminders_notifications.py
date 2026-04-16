"""Add event_reminders, notifications tables and user notification fields

Revision ID: 032
Revises: 031
Create Date: 2026-04-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '032'
down_revision: Union[str, None] = '031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS event_reminders (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            minutes_before INTEGER NOT NULL,
            notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
            notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
            notify_email BOOLEAN NOT NULL DEFAULT FALSE,
            last_notified_occurrence TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_event_reminders_event_id ON event_reminders(event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_event_reminders_user_id ON event_reminders(user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            body TEXT,
            event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_event_id ON notifications(event_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications")
    op.execute("DROP TABLE IF EXISTS event_reminders")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notification_email")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS telegram_chat_id")
