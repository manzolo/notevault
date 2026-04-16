from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.database import Event, EventReminder, User
from app.schemas.reminder import EventReminderCreate, EventReminderResponse, EventReminderUpdate
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/events/{event_id}/reminders", tags=["reminders"])

_MAX_REMINDERS_PER_EVENT = 5


async def _get_event_or_404(event_id: int, user: User, db: AsyncSession) -> Event:
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("", response_model=List[EventReminderResponse])
async def list_reminders(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_or_404(event_id, current_user, db)
    result = await db.execute(
        select(EventReminder)
        .where(EventReminder.event_id == event_id, EventReminder.user_id == current_user.id)
        .order_by(EventReminder.minutes_before)
    )
    return result.scalars().all()


@router.post("", response_model=EventReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    event_id: int,
    data: EventReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_or_404(event_id, current_user, db)

    count_result = await db.execute(
        select(EventReminder).where(
            EventReminder.event_id == event_id,
            EventReminder.user_id == current_user.id,
        )
    )
    if len(count_result.scalars().all()) >= _MAX_REMINDERS_PER_EVENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {_MAX_REMINDERS_PER_EVENT} reminders per event",
        )

    reminder = EventReminder(
        event_id=event_id,
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.put("/{reminder_id}", response_model=EventReminderResponse)
async def update_reminder(
    event_id: int,
    reminder_id: int,
    data: EventReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_or_404(event_id, current_user, db)
    result = await db.execute(
        select(EventReminder).where(
            EventReminder.id == reminder_id,
            EventReminder.event_id == event_id,
            EventReminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    event_id: int,
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_or_404(event_id, current_user, db)
    result = await db.execute(
        select(EventReminder).where(
            EventReminder.id == reminder_id,
            EventReminder.event_id == event_id,
            EventReminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    await db.delete(reminder)
    await db.commit()
