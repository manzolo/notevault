from typing import List
from pydantic import BaseModel
from app.schemas.note import NoteResponse


class SearchResponse(BaseModel):
    items: List[NoteResponse]
    total: int
    query: str
