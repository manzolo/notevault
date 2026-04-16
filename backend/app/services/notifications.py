import logging
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Notification

logger = logging.getLogger(__name__)


async def send_in_app(
    db: AsyncSession,
    user_id: int,
    title: str,
    body: Optional[str],
    event_id: Optional[int] = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        event_id=event_id,
    )
    db.add(notif)


async def send_telegram(chat_id: str, bot_token: str, text: str) -> None:
    if not bot_token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "MarkdownV2"})
    except Exception as exc:
        logger.warning("Telegram send failed: %s", exc)


async def send_email(
    to: str,
    subject: str,
    body: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    use_tls: bool,
) -> None:
    if not smtp_host or not to:
        return
    try:
        import aiosmtplib
        from email.mime.text import MIMEText

        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = smtp_from or smtp_user
        msg["To"] = to

        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user or None,
            password=smtp_password or None,
            start_tls=use_tls,
        )
    except Exception as exc:
        logger.warning("Email send failed to %s: %s", to, exc)


def _format_dt_local(dt: datetime, tz_name: str) -> str:
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    local = dt.astimezone(tz)
    return local.strftime("%d/%m/%Y %H:%M")


def _escape_mdv2(text: str) -> str:
    return "".join(f"\\{c}" if c in r"_*[]()~`>#+-=|{}.!" else c for c in text)


def _anticipation_label(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} min prima"
    if minutes < 1440:
        return f"{minutes // 60}h prima"
    if minutes < 10080:
        return f"{minutes // 1440}g prima"
    return f"{minutes // 10080} sett. prima"


def _build_telegram_text(event_title: str, event_description: Optional[str],
                          occurrence_dt: datetime, minutes_before: int, tz_name: str) -> str:
    local_time = _format_dt_local(occurrence_dt, tz_name)
    safe_title = _escape_mdv2(event_title)
    safe_time = _escape_mdv2(local_time)
    safe_anticipation = _escape_mdv2(_anticipation_label(minutes_before))
    text = (
        f"🔔 *NoteVault* — Promemoria \\({safe_anticipation}\\)\n\n"
        f"📅 *{safe_title}*\n"
        f"⏰ {safe_time}\n"
    )
    if event_description:
        snippet = event_description[:120].strip()
        if len(event_description) > 120:
            snippet += "…"
        text += f"\n_{_escape_mdv2(snippet)}_\n"
    return text


def _build_inapp_body(occurrence_dt: datetime, tz_name: str,
                       event_description: Optional[str], minutes_before: int) -> str:
    parts = [f"{_anticipation_label(minutes_before)} · {_format_dt_local(occurrence_dt, tz_name)}"]
    if event_description:
        snippet = event_description[:80].strip()
        if len(event_description) > 80:
            snippet += "…"
        parts.append(snippet)
    return " — ".join(parts)


async def dispatch_reminder(
    db: AsyncSession,
    event,
    reminder,
    occurrence_dt: datetime,
    bot_token: str,
    smtp_cfg: dict,
) -> None:
    from app.config import get_settings
    tz_name = get_settings().timezone

    user = event.user
    desc = event.description or ""
    inapp_title = f"📅 {event.title}"
    inapp_body = _build_inapp_body(occurrence_dt, tz_name, desc, reminder.minutes_before)

    if reminder.notify_in_app:
        await send_in_app(db, user.id, inapp_title, inapp_body, event.id)

    if reminder.notify_telegram and user.telegram_chat_id:
        tg_text = _build_telegram_text(event.title, desc, occurrence_dt, reminder.minutes_before, tz_name)
        await send_telegram(user.telegram_chat_id, bot_token, tg_text)

    if reminder.notify_email:
        email_to = user.notification_email or user.email
        await send_email(
            to=email_to,
            subject=inapp_title,
            body=inapp_body,
            **smtp_cfg,
        )
