import base64
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

    # App
    app_name: str = "NoteVault"
    debug: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def master_key_bytes(self) -> bytes:
        try:
            return base64.b64decode(self.master_key)
        except Exception:
            return self.master_key.encode()[:32].ljust(32, b'\x00')

    model_config = {"env_file": ".env", "case_sensitive": False, "env_prefix": ""}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
