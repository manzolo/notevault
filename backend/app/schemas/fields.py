from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class NoteFieldCreate(BaseModel):
    group_name: str = ''
    key: str
    value: str = ''
    position: int = 0
    link: Optional[str] = None
    field_note: Optional[str] = None
    field_date: Optional[date] = None
    price: Optional[str] = None
    field_image: Optional[str] = None


class NoteFieldUpdate(BaseModel):
    group_name: Optional[str] = None
    key: Optional[str] = None
    value: Optional[str] = None
    position: Optional[int] = None
    link: Optional[str] = None
    field_note: Optional[str] = None
    field_date: Optional[date] = None
    price: Optional[str] = None
    field_image: Optional[str] = None


class NoteFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    group_name: str
    key: str
    value: str
    position: int
    link: Optional[str] = None
    field_note: Optional[str] = None
    field_date: Optional[date] = None
    price: Optional[str] = None
    field_image: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class NoteFieldGroup(BaseModel):
    group_name: str
    fields: List[NoteFieldResponse]


class NoteFieldReorderItem(BaseModel):
    id: int
    position: int


class FieldDateEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    note_title: str
    group_name: str
    key: str
    value: str
    field_date: date
    link: Optional[str] = None
    price: Optional[str] = None
