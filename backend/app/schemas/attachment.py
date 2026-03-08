from datetime import datetime
from typing import List
from pydantic import BaseModel
from app.schemas.tag import TagResponse


class AttachmentResponse(BaseModel):
    id: int
    note_id: int
    filename: str
    mime_type: str
    size_bytes: int
    tags: List[TagResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class AttachmentTagUpdate(BaseModel):
    tag_ids: List[int] = []
