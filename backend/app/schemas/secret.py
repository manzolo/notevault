from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.enums import SecretType


class SecretCreate(BaseModel):
    name: str
    secret_type: SecretType = SecretType.OTHER
    value: str
    username: Optional[str] = None
    url: Optional[str] = None
    public_key: Optional[str] = None

    def __repr__(self) -> str:
        return f"SecretCreate(name={self.name!r}, secret_type={self.secret_type!r}, value={{REDACTED}})"


class SecretResponse(BaseModel):
    id: int
    name: str
    secret_type: SecretType
    username: Optional[str] = None
    url: Optional[str] = None
    public_key: Optional[str] = None
    note_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SecretRevealResponse(BaseModel):
    id: int
    name: str
    secret_type: SecretType
    username: Optional[str] = None
    url: Optional[str] = None
    public_key: Optional[str] = None
    value: str
    note_id: int
