from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    totp_enabled: bool
    calendar_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    notification_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserNotificationUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None
    notification_email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Login endpoint response — either a full token or a TOTP challenge."""
    access_token: Optional[str] = None
    token_type: str = "bearer"
    totp_required: bool = False
    partial_token: Optional[str] = None


class TotpSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class TotpEnableRequest(BaseModel):
    secret: str
    code: str


class TotpDisableRequest(BaseModel):
    password: str


class TotpVerifyRequest(BaseModel):
    partial_token: str
    code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
