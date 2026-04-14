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


class MatchingBookmark(BaseModel):
    id: int
    note_id: int
    url: str
    title: str | None = None
    description: str | None = None

    class Config:
        from_attributes = True


class MatchingField(BaseModel):
    id: int
    note_id: int
    group_name: str
    key: str
    value: str

    class Config:
        from_attributes = True


class SearchNoteResponse(NoteResponse):
    match_in_attachment: bool = False
    match_in_bookmark: bool = False
    match_in_fields: bool = False
    matching_attachments: List[MatchingAttachment] = []
    matching_bookmarks: List[MatchingBookmark] = []
    matching_fields: List[MatchingField] = []

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    items: List[SearchNoteResponse]
    total: int
    query: str
    page: int = 1
    per_page: int = 20
    pages: int = 1
