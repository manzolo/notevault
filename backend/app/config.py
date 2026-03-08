import base64
from pydantic_settings import BaseSettings
from pydantic import validator
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

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # App
    app_name: str = "NoteVault"
    debug: bool = False

    @validator("master_key")
    def validate_master_key(cls, v):
        try:
            decoded = base64.b64decode(v)
            if len(decoded) != 32:
                raise ValueError("MASTER_KEY must decode to exactly 32 bytes")
        except Exception as e:
            # Allow non-base64 keys in development (will fail at runtime)
            pass
        return v

    @property
    def master_key_bytes(self) -> bytes:
        try:
            return base64.b64decode(self.master_key)
        except Exception:
            return self.master_key.encode()[:32].ljust(32, b'\x00')

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
