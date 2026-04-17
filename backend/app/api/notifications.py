from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.database.connection import get_db
from app.models.database import Notification, User
from app.schemas.notification import NotificationCountResponse, NotificationResponse, SnoozeRequest
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_MAX_LIST = 50


def _not_snoozed(now: datetime):
    """SQLAlchemy clause: notification is not currently snoozed."""
    return (Notification.snoozed_until == None) | (Notification.snoozed_until <= now)  # noqa: E711


@router.get("/count", response_model=NotificationCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            _not_snoozed(now),
        )
    )
    return NotificationCountResponse(unread=result.scalar_one())


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    q = select(Notification).where(
        Notification.user_id == current_user.id,
        _not_snoozed(now),
    )
    if unread is True:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).limit(_MAX_LIST)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            _not_snoozed(now),
        )
        .values(is_read=True)
    )
    await db.commit()


@router.post("/{notification_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def snooze_notification(
    notification_id: int,
    body: SnoozeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.minutes < 1 or body.minutes > 10080:  # max 1 week
        raise HTTPException(status_code=400, detail="minutes must be between 1 and 10080")
    snoozed_until = datetime.now(tz=timezone.utc) + timedelta(minutes=body.minutes)
    result = await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == current_user.id)
        .values(snoozed_until=snoozed_until, is_read=False)
        .returning(Notification.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
