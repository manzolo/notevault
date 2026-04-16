import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.database.connection import AsyncSessionLocal
from app.models.database import Event, EventReminder, Notification, User
from app.services.notifications import dispatch_reminder

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


async def check_reminders() -> None:
    """APScheduler job: fire due reminders. Runs every 60 seconds."""
    now = datetime.now(tz=timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EventReminder).options(
                    selectinload(EventReminder.event).selectinload(Event.user),
                    selectinload(EventReminder.event).selectinload(Event.note)
                )
            )
            reminders = result.scalars().all()

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
