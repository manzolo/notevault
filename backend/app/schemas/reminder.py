from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class EventReminderCreate(BaseModel):
    minutes_before: int
    notify_in_app: bool = True
    notify_telegram: bool = False
    notify_email: bool = False

    @field_validator("minutes_before")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("minutes_before must be positive")
        return v


class EventReminderUpdate(BaseModel):
    minutes_before: Optional[int] = None
    notify_in_app: Optional[bool] = None
    notify_telegram: Optional[bool] = None
    notify_email: Optional[bool] = None


class EventReminderResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    minutes_before: int
    notify_in_app: bool
    notify_telegram: bool
    notify_email: bool
    last_notified_occurrence: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskReminderCreate(BaseModel):
    minutes_before: int
    notify_in_app: bool = True
    notify_telegram: bool = False
    notify_email: bool = False

    @field_validator("minutes_before")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("minutes_before must be positive")
        return v


class TaskReminderUpdate(BaseModel):
    minutes_before: Optional[int] = None
    notify_in_app: Optional[bool] = None
    notify_telegram: Optional[bool] = None
    notify_email: Optional[bool] = None


class TaskReminderResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    minutes_before: int
    notify_in_app: bool
    notify_telegram: bool
    notify_email: bool
    notified_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
