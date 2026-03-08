from typing import List
from pydantic import BaseModel
from app.schemas.note import NoteResponse


class SearchNoteResponse(NoteResponse):
    match_in_attachment: bool = False

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    items: List[SearchNoteResponse]
    total: int
    query: str
