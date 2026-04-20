from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.tag import TagResponse


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    is_pinned: bool = False
    is_archived: bool = False
    category_id: Optional[int] = None
    tag_ids: List[int] = []


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    category_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    is_pinned: bool
    is_archived: bool
    user_id: int
    category_id: Optional[int]
    journal_date: Optional[date] = None
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    task_count: int = 0
    event_count: int = 0
    secret_count: int = 0

class NoteListResponse(BaseModel):
    items: List[NoteResponse]
    total: int
    page: int
    per_page: int
    pages: int


class DailyNoteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    journal_date: Optional[date] = Field(default=None, alias="date")
    locale: Optional[str] = None


class DailyNoteResponse(BaseModel):
    note_id: int
    created: bool


class JournalAdjacentResponse(BaseModel):
    prev_date: Optional[date] = None
    prev_id: Optional[int] = None
    next_date: Optional[date] = None
    next_id: Optional[int] = None
