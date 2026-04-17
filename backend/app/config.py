import base64
import hashlib
from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://notevault:changeme@db:5432/notevault"
    test_database_url: str = "postgresql+asyncpg://notevault:changeme@db:5432/notevault_test"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Security
    secret_key: str = "changeme"
    master_key: str = "changeme"
    algorithm: str = "HS256"
    access_token_expire_days: int = 7

    # CORS — stored as str to avoid pydantic-settings JSON-parsing list fields from env
    cors_origins: str = "http://localhost:3000"

    # Uploads
    upload_dir: str = "/app/data/uploads"
    max_upload_bytes: int = 10 * 1024 * 1024

    # TOTP — set TOTP_REQUIRED=false to disable 2FA enforcement (e.g. local dev)
    totp_required: bool = True

    # Bookmarks — fetch favicon from origin/favicon.ico (off by default, privacy-preserving)
    favicon_fetch_enabled: bool = False

    # Telegram
    telegram_bot_token: str = ""

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True

    # Timezone for notification formatting (IANA tz name, e.g. Europe/Rome)
    timezone: str = "Europe/Rome"

    # App
    app_name: str = "NoteVault"
    app_base_url: str = ""
    debug: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def master_key_bytes(self) -> bytes:
        try:
            key = base64.b64decode(self.master_key)
        except Exception:
            key = self.master_key.encode()
        # AES-256-GCM requires exactly 32 bytes; derive via SHA-256 if needed
        if len(key) != 32:
            key = hashlib.sha256(key).digest()
        return key

    model_config = {"env_file": ".env", "case_sensitive": False, "env_prefix": ""}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
