from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.database.connection import get_db
from app.models.database import Notification, User
from app.schemas.notification import NotificationCountResponse, NotificationResponse
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_MAX_LIST = 50


@router.get("/count", response_model=NotificationCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    return NotificationCountResponse(unread=result.scalar_one())


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
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
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
