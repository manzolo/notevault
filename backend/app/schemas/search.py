from typing import List
from pydantic import BaseModel
from app.schemas.note import NoteResponse


class MatchingAttachment(BaseModel):
    id: int
    note_id: int
    filename: str
    mime_type: str

    class Config:
        from_attributes = True


class SearchNoteResponse(NoteResponse):
    match_in_attachment: bool = False
    match_in_bookmark: bool = False
    matching_attachments: List[MatchingAttachment] = []

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    items: List[SearchNoteResponse]
    total: int
    query: str
    page: int = 1
    per_page: int = 20
    pages: int = 1
