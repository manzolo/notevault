from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database.connection import get_db
from app.models.database import Task, Note, User
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskWithNoteResponse
from app.security.dependencies import get_current_user


class ReorderItem(BaseModel):
    id: int
    position: int

router = APIRouter(tags=["tasks"])


async def _get_note_owned(note_id: int, user: User, db: AsyncSession) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


async def _get_task_owned(task_id: int, note_id: int, user: User, db: AsyncSession) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.note_id == note_id, Task.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/api/notes/{note_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    note_id: int,
    include_archived: bool = Query(False),
    archived_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    q = select(Task).where(Task.note_id == note_id, Task.user_id == current_user.id)
    if archived_only:
        q = q.where(Task.is_archived == True)  # noqa: E712
    elif not include_archived:
        q = q.where(Task.is_archived == False)  # noqa: E712
    result = await db.execute(q.order_by(Task.position, Task.created_at))
    return result.scalars().all()


@router.post("/api/notes/{note_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    note_id: int,
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    task = Task(
        note_id=note_id,
        user_id=current_user.id,
        title=data.title,
        is_done=data.is_done,
        due_date=data.due_date,
        position=data.position,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


@router.patch("/api/notes/{note_id}/tasks/reorder", status_code=status.HTTP_200_OK)
async def reorder_tasks(
    note_id: int,
    items: List[ReorderItem],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    for item in items:
        await db.execute(
            update(Task)
            .where(Task.id == item.id, Task.note_id == note_id, Task.user_id == current_user.id)
            .values(position=item.position)
        )
    await db.commit()
    return {"ok": True}


@router.put("/api/notes/{note_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    note_id: int,
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_owned(task_id, note_id, current_user, db)
    if data.title is not None:
        task.title = data.title
    if data.is_done is not None:
        task.is_done = data.is_done
    if data.due_date is not None or "due_date" in data.model_fields_set:
        task.due_date = data.due_date
    if data.position is not None:
        task.position = data.position
    if data.is_archived is not None:
        task.is_archived = data.is_archived
        task.archive_note = data.archive_note if data.is_archived else None
    await db.flush()
    await db.refresh(task)
    return task


@router.delete("/api/notes/{note_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    note_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_owned(task_id, note_id, current_user, db)
    await db.delete(task)


@router.get("/api/tasks", response_model=list[TaskWithNoteResponse])
async def list_all_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    include_archived: bool = Query(False),
    archived_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all tasks for the current user across all notes."""
    q = select(Task, Note.title.label("note_title")).join(Note, Task.note_id == Note.id).where(
        Task.user_id == current_user.id
    )
    if status_filter == "todo":
        q = q.where(Task.is_done == False)  # noqa: E712
    elif status_filter == "done":
        q = q.where(Task.is_done == True)  # noqa: E712
    if archived_only:
        q = q.where(Task.is_archived == True)  # noqa: E712
    elif not include_archived:
        q = q.where(Task.is_archived == False)  # noqa: E712
    q = q.order_by(Task.is_done, Task.due_date.nulls_last(), Task.created_at)
    result = await db.execute(q)
    rows = result.all()
    out = []
    for task, note_title in rows:
        d = TaskWithNoteResponse(
            id=task.id,
            note_id=task.note_id,
            user_id=task.user_id,
            title=task.title,
            is_done=task.is_done,
            due_date=task.due_date,
            position=task.position,
            created_at=task.created_at,
            updated_at=task.updated_at,
            note_title=note_title,
        )
        out.append(d)
    return out
