from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, HttpUrl
from app.schemas.tag import TagResponse


class BookmarkCreate(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class BookmarkUpdate(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class BookmarkResponse(BaseModel):
    id: int
    note_id: int
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    position: int = 0
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
