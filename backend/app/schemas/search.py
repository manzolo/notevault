from typing import List
from pydantic import BaseModel, ConfigDict
from app.schemas.note import NoteResponse


class MatchingAttachment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    filename: str
    mime_type: str

class MatchingBookmark(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    url: str
    title: str | None = None
    description: str | None = None

class MatchingField(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    group_name: str
    key: str
    value: str

class MatchingEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    title: str
    description: str | None = None
    start_datetime: str

class MatchingTask(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    title: str
    is_done: bool = False

class SearchNoteResponse(NoteResponse):
    model_config = ConfigDict(from_attributes=True)

    match_in_attachment: bool = False
    match_in_bookmark: bool = False
    match_in_fields: bool = False
    match_in_event: bool = False
    match_in_task: bool = False
    matching_attachments: List[MatchingAttachment] = []
    matching_bookmarks: List[MatchingBookmark] = []
    matching_fields: List[MatchingField] = []
    matching_events: List[MatchingEvent] = []
    matching_tasks: List[MatchingTask] = []

class SearchResponse(BaseModel):
    items: List[SearchNoteResponse]
    total: int
    query: str
    page: int = 1
    per_page: int = 20
    pages: int = 1
