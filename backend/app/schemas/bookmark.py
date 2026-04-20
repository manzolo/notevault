from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
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
    is_archived: Optional[bool] = None
    archive_note: Optional[str] = None


class BookmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    position: int = 0
    is_archived: bool = False
    archive_note: Optional[str] = None
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime
