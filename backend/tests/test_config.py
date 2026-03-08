import base64
import pytest
from app.config import Settings


def test_settings_defaults():
    s = Settings()
    assert s.algorithm == "HS256"
    assert s.access_token_expire_days == 7


def test_master_key_bytes_valid():
    key = base64.b64encode(b"a" * 32).decode()
    s = Settings(master_key=key, secret_key="test")
    assert s.master_key_bytes == b"a" * 32


def test_master_key_bytes_fallback():
    # Non-base64 key falls back to padded bytes
    s = Settings(master_key="shortkey", secret_key="test")
    result = s.master_key_bytes
    assert len(result) == 32
