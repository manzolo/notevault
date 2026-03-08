from typing import List
from pydantic import BaseModel
from app.schemas.note import NoteResponse


class SearchNoteResponse(NoteResponse):
    match_in_attachment: bool = False
    match_in_bookmark: bool = False

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    items: List[SearchNoteResponse]
    total: int
    query: str
    page: int = 1
    per_page: int = 20
    pages: int = 1
