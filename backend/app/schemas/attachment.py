from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.tag import TagResponse


class AttachmentResponse(BaseModel):
    id: int
    note_id: int
    filename: str
    mime_type: str
    size_bytes: int
    description: Optional[str] = None
    file_modified_at: Optional[datetime] = None
    position: int = 0
    is_archived: bool = False
    archive_note: Optional[str] = None
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AttachmentTagUpdate(BaseModel):
    tag_ids: List[int] = []


class AttachmentUpdate(BaseModel):
    filename: Optional[str] = None
    description: Optional[str] = None
    tag_ids: Optional[List[int]] = None
    is_archived: Optional[bool] = None
    archive_note: Optional[str] = None
