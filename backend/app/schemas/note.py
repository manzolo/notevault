from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
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
    id: int
    title: str
    content: str
    is_pinned: bool
    is_archived: bool
    user_id: int
    category_id: Optional[int]
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    items: List[NoteResponse]
    total: int
    page: int
    per_page: int
    pages: int
