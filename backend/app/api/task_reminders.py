from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.database import Task, TaskReminder, User
from app.schemas.reminder import TaskReminderCreate, TaskReminderResponse, TaskReminderUpdate
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/tasks/{task_id}/reminders", tags=["task_reminders"])

_MAX_REMINDERS_PER_TASK = 5


async def _get_task_or_404(task_id: int, user: User, db: AsyncSession) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=List[TaskReminderResponse])
async def list_task_reminders(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_task_or_404(task_id, current_user, db)
    result = await db.execute(
        select(TaskReminder)
        .where(TaskReminder.task_id == task_id, TaskReminder.user_id == current_user.id)
        .order_by(TaskReminder.minutes_before)
    )
    return result.scalars().all()


@router.post("", response_model=TaskReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_task_reminder(
    task_id: int,
    data: TaskReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_task_or_404(task_id, current_user, db)

    count_result = await db.execute(
        select(TaskReminder).where(
            TaskReminder.task_id == task_id,
            TaskReminder.user_id == current_user.id,
        )
    )
    if len(count_result.scalars().all()) >= _MAX_REMINDERS_PER_TASK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {_MAX_REMINDERS_PER_TASK} reminders per task",
        )

    reminder = TaskReminder(
        task_id=task_id,
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.put("/{reminder_id}", response_model=TaskReminderResponse)
async def update_task_reminder(
    task_id: int,
    reminder_id: int,
    data: TaskReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_task_or_404(task_id, current_user, db)
    result = await db.execute(
        select(TaskReminder).where(
            TaskReminder.id == reminder_id,
            TaskReminder.task_id == task_id,
            TaskReminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    update_data = data.model_dump(exclude_unset=True)
    # Reset notified_at when minutes_before changes so the scheduler re-evaluates
    if "minutes_before" in update_data and update_data["minutes_before"] != reminder.minutes_before:
        reminder.notified_at = None
    for field, value in update_data.items():
        setattr(reminder, field, value)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_reminder(
    task_id: int,
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_task_or_404(task_id, current_user, db)
    result = await db.execute(
        select(TaskReminder).where(
            TaskReminder.id == reminder_id,
            TaskReminder.task_id == task_id,
            TaskReminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    await db.delete(reminder)
    await db.commit()
