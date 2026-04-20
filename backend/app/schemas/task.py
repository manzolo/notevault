from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


def _coerce_date_str(v: object) -> object:
    """Accept 'YYYY-MM-DD' strings alongside full datetime strings."""
    if isinstance(v, str) and len(v) == 10:
        return f"{v}T00:00:00"
    return v


class TaskCreate(BaseModel):
    title: str
    is_done: bool = False
    due_date: Optional[datetime] = None
    position: int = 0

    @field_validator("due_date", mode="before")
    @classmethod
    def parse_due_date(cls, v: object) -> object:
        return _coerce_date_str(v)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None
    due_date: Optional[datetime] = None
    position: Optional[int] = None
    is_archived: Optional[bool] = None
    archive_note: Optional[str] = None

    @field_validator("due_date", mode="before")
    @classmethod
    def parse_due_date(cls, v: object) -> object:
        return _coerce_date_str(v)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    user_id: int
    title: str
    is_done: bool
    due_date: Optional[datetime] = None
    position: int
    is_archived: bool = False
    archive_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class TaskWithNoteResponse(TaskResponse):
    note_title: str
