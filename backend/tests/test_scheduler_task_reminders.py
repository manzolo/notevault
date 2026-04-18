from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.scheduler import _task_trigger_time


def _dt(offset_minutes: int = 0) -> datetime:
    return datetime.now(tz=timezone.utc) + timedelta(minutes=offset_minutes)


def _make_task(due_date=None, is_done=False, is_archived=False, note_title="Note"):
    task = MagicMock()
    task.due_date = due_date
    task.is_done = is_done
    task.is_archived = is_archived
    task.id = 1
    task.title = "Task Title"
    note = MagicMock()
    note.title = note_title
    task.note = note
    user = MagicMock()
    user.id = 1
    user.telegram_chat_id = None
    user.notification_email = None
    user.email = "user@example.com"
    task.user = user
    return task


def _make_reminder(minutes_before=60, notified_at=None, in_app=True, telegram=False, email=False):
    r = MagicMock()
    r.id = 1
    r.minutes_before = minutes_before
    r.notified_at = notified_at
    r.notify_in_app = in_app
    r.notify_telegram = telegram
    r.notify_email = email
    return r


# ── _task_trigger_time ────────────────────────────────────────────────────────

def test_trigger_time_no_due_date():
    task = _make_task(due_date=None)
    assert _task_trigger_time(task, 60) is None


def test_trigger_time_correct_utc():
    due = _dt(120)
    task = _make_task(due_date=due)
    trigger = _task_trigger_time(task, 60)
    assert trigger == due - timedelta(minutes=60)


def test_trigger_time_zero_minutes():
    due = _dt(30)
    task = _make_task(due_date=due)
    assert _task_trigger_time(task, 0) == due


# ── scheduler loop (mocked DB) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_called_when_trigger_past():
    due = _dt(-1)  # due 1 minute ago → trigger (60 min before) already passed
    task = _make_task(due_date=due)
    reminder = _make_reminder(minutes_before=60, notified_at=None)

    with (
        patch("app.services.scheduler.dispatch_task_reminder", new_callable=AsyncMock) as mock_dispatch,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="", smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
        )
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))
        # Return our task reminder in second execute (task reminders query)
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # events query → empty
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))
            else:
                # task reminders query
                return MagicMock(scalars=lambda: MagicMock(all=lambda: [reminder]))

        db.execute = fake_execute
        db.commit = AsyncMock()

        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        reminder.task = task
        from app.services.scheduler import check_reminders
        await check_reminders()

        mock_dispatch.assert_awaited_once()


@pytest.mark.asyncio
async def test_skip_when_notified_at_set():
    due = _dt(-1)
    task = _make_task(due_date=due)
    reminder = _make_reminder(minutes_before=60, notified_at=_dt(-70))

    with (
        patch("app.services.scheduler.dispatch_task_reminder", new_callable=AsyncMock) as mock_dispatch,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="", smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
        )
        db = AsyncMock()
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))
            return MagicMock(scalars=lambda: MagicMock(all=lambda: [reminder]))

        db.execute = fake_execute
        db.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        reminder.task = task
        from app.services.scheduler import check_reminders
        await check_reminders()

        mock_dispatch.assert_not_awaited()


@pytest.mark.asyncio
async def test_snooze_redispatch_sends_telegram():
    """When a snoozed notification expires and notify_telegram=True, Telegram is re-sent."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from datetime import timedelta, timezone
    import datetime as dt_module

    past = dt_module.datetime.now(tz=timezone.utc) - timedelta(minutes=1)

    # Build a mock notification that looks like a snoozed task notification
    notif = MagicMock()
    notif.notify_telegram = True
    notif.notify_email = False
    notif.snoozed_until = past
    notif.snooze_dispatched = False
    notif.event_id = None
    notif.task_id = 42

    task = MagicMock()
    task.title = "My Task"
    note = MagicMock()
    note.title = "My Note"
    task.note = note
    notif.task = task

    user = MagicMock()
    user.telegram_chat_id = "123456789"
    user.notification_email = None
    user.email = "user@example.com"
    notif.user = user

    with (
        patch("app.services.scheduler.send_telegram", new_callable=AsyncMock) as mock_tg,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="bot-token",
            smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
            timezone="UTC",
        )
        db = AsyncMock()
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))  # events
            elif call_count == 2:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))  # task reminders
            elif call_count == 3:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: [notif]))  # snoozed
            else:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))  # delete purge

        db.execute = fake_execute
        db.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.scheduler import check_reminders
        await check_reminders()

        mock_tg.assert_awaited_once()
        assert notif.snooze_dispatched is True


@pytest.mark.asyncio
async def test_snooze_redispatch_skips_telegram_when_false():
    """When notify_telegram=False on notification, Telegram is NOT re-sent on snooze expiry."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from datetime import timedelta, timezone
    import datetime as dt_module

    past = dt_module.datetime.now(tz=timezone.utc) - timedelta(minutes=1)

    notif = MagicMock()
    notif.notify_telegram = False
    notif.notify_email = False
    notif.snoozed_until = past
    notif.snooze_dispatched = False
    notif.event_id = None
    notif.task_id = 42
    notif.task = MagicMock()
    notif.user = MagicMock(telegram_chat_id="123", notification_email=None, email="u@e.com")

    with (
        patch("app.services.scheduler.send_telegram", new_callable=AsyncMock) as mock_tg,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="bot-token",
            smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
            timezone="UTC",
        )
        db = AsyncMock()
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 3:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: [notif]))
            return MagicMock(scalars=lambda: MagicMock(all=lambda: []))

        db.execute = fake_execute
        db.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.scheduler import check_reminders
        await check_reminders()

        mock_tg.assert_not_awaited()
        assert notif.snooze_dispatched is True


@pytest.mark.asyncio
async def test_skip_when_is_done():
    task = _make_task(due_date=_dt(-1), is_done=True)
    reminder = _make_reminder(minutes_before=60, notified_at=None)
    reminder.task = task

    with (
        patch("app.services.scheduler.dispatch_task_reminder", new_callable=AsyncMock) as mock_dispatch,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="", smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
        )
        db = AsyncMock()
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))
            return MagicMock(scalars=lambda: MagicMock(all=lambda: [reminder]))

        db.execute = fake_execute
        db.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.scheduler import check_reminders
        await check_reminders()
        mock_dispatch.assert_not_awaited()


@pytest.mark.asyncio
async def test_skip_when_no_due_date():
    task = _make_task(due_date=None)
    reminder = _make_reminder(minutes_before=60, notified_at=None)
    reminder.task = task

    with (
        patch("app.services.scheduler.dispatch_task_reminder", new_callable=AsyncMock) as mock_dispatch,
        patch("app.services.scheduler.AsyncSessionLocal") as mock_session_cls,
        patch("app.config.get_settings") as mock_settings,
    ):
        mock_settings.return_value = MagicMock(
            telegram_bot_token="", smtp_host="", smtp_port=587,
            smtp_user="", smtp_password="", smtp_from="", smtp_tls=False,
        )
        db = AsyncMock()
        call_count = 0

        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(scalars=lambda: MagicMock(all=lambda: []))
            return MagicMock(scalars=lambda: MagicMock(all=lambda: [reminder]))

        db.execute = fake_execute
        db.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=db)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.scheduler import check_reminders
        await check_reminders()
        mock_dispatch.assert_not_awaited()
