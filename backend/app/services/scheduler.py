import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.database.connection import AsyncSessionLocal
from app.models.database import Event, EventReminder, Notification, Task, TaskReminder, User
from app.services.notifications import (
    dispatch_reminder, dispatch_task_reminder, send_telegram, send_email,
    _build_telegram_text, _build_task_telegram_text,
    _build_event_email_body, _build_task_email_body,
    _build_email_subject, _format_dt_local, _anticipation_label,
    _escape_mdv2,
)

logger = logging.getLogger(__name__)


def _next_occurrence_after(event: Event, after: datetime | None) -> datetime | None:
    """Return the next occurrence of `event` at or after `after`, or None if already notified."""
    start = event.start_datetime

    if not event.recurrence_rule:
        # Non-recurring: fire once
        if after is None:
            return start
        return None

    # First notification OR last_notified_occurrence is before current start
    # (event was rescheduled forward): treat start_datetime as the occurrence.
    start_s = start.replace(microsecond=0)
    after_s = after.replace(microsecond=0) if after else None
    if after_s is None or after_s < start_s:
        return start

    try:
        from dateutil.rrule import rrulestr
    except ImportError:
        return None

    try:
        rule = rrulestr(event.recurrence_rule, dtstart=start_s)
    except Exception:
        return None

    horizon = datetime.now(tz=timezone.utc) + timedelta(days=30)
    search_from = after.replace(microsecond=0) + timedelta(seconds=1)
    occurrences = list(rule.between(search_from, horizon, inc=True))
    return occurrences[0] if occurrences else None


def _datetimes_equal(a: datetime, b: datetime) -> bool:
    return abs((a - b).total_seconds()) < 1


def _task_trigger_time(task: Task, minutes_before: int) -> datetime | None:
    """Return the UTC trigger time for a task reminder, or None if no due_date."""
    if not task.due_date:
        return None
    return task.due_date - timedelta(minutes=minutes_before)


async def check_reminders() -> None:
    """APScheduler job: fire due reminders. Runs every 60 seconds."""
    now = datetime.now(tz=timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            from app.config import get_settings
            settings = get_settings()
            smtp_cfg = {
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "smtp_user": settings.smtp_user,
                "smtp_password": settings.smtp_password,
                "smtp_from": settings.smtp_from,
                "use_tls": settings.smtp_tls,
            }

            # ── Event reminders ──────────────────────────────────────────────
            result = await db.execute(
                select(EventReminder).options(
                    selectinload(EventReminder.event).selectinload(Event.user),
                    selectinload(EventReminder.event).selectinload(Event.note)
                )
            )
            reminders = result.scalars().all()

            for reminder in reminders:
                event = reminder.event
                if event.is_archived:
                    continue

                next_occ = _next_occurrence_after(event, reminder.last_notified_occurrence)
                if next_occ is None:
                    continue

                # Occurrence already in the past (e.g. reminder added after the event):
                # advance silently without notifying, so the next future occurrence fires instead.
                if next_occ < now:
                    reminder.last_notified_occurrence = next_occ
                    continue

                trigger_time = next_occ - timedelta(minutes=reminder.minutes_before)
                if trigger_time > now:
                    continue

                if reminder.last_notified_occurrence and _datetimes_equal(
                    reminder.last_notified_occurrence, next_occ
                ):
                    continue

                logger.info(
                    "Firing reminder %d for event %d (occurrence %s)",
                    reminder.id,
                    event.id,
                    next_occ,
                )
                await dispatch_reminder(
                    db=db,
                    event=event,
                    reminder=reminder,
                    occurrence_dt=next_occ,
                    bot_token=settings.telegram_bot_token,
                    smtp_cfg=smtp_cfg,
                )
                reminder.last_notified_occurrence = next_occ

            # ── Task reminders ───────────────────────────────────────────────
            task_result = await db.execute(
                select(TaskReminder).options(
                    selectinload(TaskReminder.task).selectinload(Task.user),
                    selectinload(TaskReminder.task).selectinload(Task.note),
                )
            )
            task_reminders = task_result.scalars().all()

            for tr in task_reminders:
                task = tr.task
                # Skip if task is archived, done, or has no due_date
                if task.is_archived or task.is_done or not task.due_date:
                    continue
                # Skip if already fired
                if tr.notified_at is not None:
                    continue

                trigger_time = _task_trigger_time(task, tr.minutes_before)
                if trigger_time is None or trigger_time > now:
                    continue

                logger.info(
                    "Firing task reminder %d for task %d (due %s)",
                    tr.id,
                    task.id,
                    task.due_date,
                )
                await dispatch_task_reminder(
                    db=db,
                    task=task,
                    reminder=tr,
                    trigger_dt=trigger_time,
                    bot_token=settings.telegram_bot_token,
                    smtp_cfg=smtp_cfg,
                )
                tr.notified_at = now

            # ── Re-dispatch snoozed notifications ───────────────────────────
            # When a notification is snoozed, snooze_dispatched is set to False.
            # After snoozed_until expires we re-send via Telegram/Email so
            # those channels also get the reminder again.
            snoozed_result = await db.execute(
                select(Notification).where(
                    Notification.snooze_dispatched == False,  # noqa: E711
                    Notification.snoozed_until != None,       # noqa: E711
                    Notification.snoozed_until <= now,
                ).options(
                    selectinload(Notification.user),
                    selectinload(Notification.event).selectinload(Event.note),
                    selectinload(Notification.task).selectinload(Task.note),
                )
            )
            snoozed_notifications = snoozed_result.scalars().all()

            for notif in snoozed_notifications:
                user = notif.user
                tz_name = settings.timezone

                try:
                    if notif.notify_telegram and user.telegram_chat_id:
                        if notif.event_id and notif.event:
                            ev = notif.event
                            note_title = ev.note.title if ev.note else None
                            # Approximate occurrence from notification body context
                            tg_text = f"🔔 *NoteVault* — Promemoria posticipato\n\n📅 *{_escape_mdv2(ev.title)}*"
                            if note_title:
                                tg_text += f"\n📓 {_escape_mdv2(note_title)}"
                            await send_telegram(user.telegram_chat_id, settings.telegram_bot_token, tg_text)
                        elif notif.task_id and notif.task:
                            tk = notif.task
                            note_title = tk.note.title if tk.note else None
                            tg_text = f"🔔 *NoteVault* — Promemoria posticipato\n\n✅ *{_escape_mdv2(tk.title)}*"
                            if note_title:
                                tg_text += f"\n📓 {_escape_mdv2(note_title)}"
                            await send_telegram(user.telegram_chat_id, settings.telegram_bot_token, tg_text)

                    if notif.notify_email:
                        email_to = user.notification_email or user.email
                        if notif.event_id and notif.event:
                            ev = notif.event
                            note_title = ev.note.title if ev.note else None
                            subject = f"[NoteVault] Promemoria posticipato — {ev.title}"
                            body_lines = [
                                "NoteVault — Promemoria posticipato",
                                "",
                                f"📅 Evento: {ev.title}",
                            ]
                            if note_title:
                                body_lines.append(f"📓 Nota:   {note_title}")
                            await send_email(
                                to=email_to, subject=subject,
                                body="\n".join(body_lines), **smtp_cfg,
                            )
                        elif notif.task_id and notif.task:
                            tk = notif.task
                            note_title = tk.note.title if tk.note else None
                            subject = f"[NoteVault] Promemoria posticipato — {tk.title}"
                            body_lines = [
                                "NoteVault — Promemoria posticipato",
                                "",
                                f"✅ Task: {tk.title}",
                            ]
                            if note_title:
                                body_lines.append(f"📓 Nota:   {note_title}")
                            if tk.due_date:
                                body_lines.append(f"⏰ Scadenza: {_format_dt_local(tk.due_date, tz_name)}")
                            await send_email(
                                to=email_to, subject=subject,
                                body="\n".join(body_lines), **smtp_cfg,
                            )
                except Exception:
                    logger.exception("Error re-dispatching snoozed notification %d", notif.id)

                notif.snooze_dispatched = True

            # Purge read notifications older than 30 days
            cutoff = now - timedelta(days=30)
            await db.execute(
                delete(Notification).where(
                    Notification.is_read == True,
                    Notification.created_at < cutoff,
                )
            )

            await db.commit()

    except Exception:
        logger.exception("Error in check_reminders job")
