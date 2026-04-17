from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .reminder import EventReminderResponse


class EventAttachmentResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    filename: str
    mime_type: str
    size_bytes: int
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    url: Optional[str] = None
    recurrence_rule: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    url: Optional[str] = None
    recurrence_rule: Optional[str] = None
    is_archived: Optional[bool] = None
    archive_note: Optional[str] = None


class EventResponse(BaseModel):
    id: int
    note_id: int
    user_id: int
    title: str
    description: Optional[str] = None
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    url: Optional[str] = None
    recurrence_rule: Optional[str] = None
    is_archived: bool = False
    archive_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[EventAttachmentResponse] = []
    reminders: List[EventReminderResponse] = []

    model_config = {"from_attributes": True}


class EventWithNoteResponse(EventResponse):
    note_title: Optional[str] = None
