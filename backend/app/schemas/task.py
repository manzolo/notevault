from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TaskCreate(BaseModel):
    title: str
    is_done: bool = False
    due_date: Optional[datetime] = None
    position: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None
    due_date: Optional[datetime] = None
    position: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    note_id: int
    user_id: int
    title: str
    is_done: bool
    due_date: Optional[datetime] = None
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskWithNoteResponse(TaskResponse):
    note_title: str
