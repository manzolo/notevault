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


def test_master_key_bytes_fallback_non_base64():
    # Non-base64 chars (!) → fallback path → SHA-256 → 32 bytes
    s = Settings(master_key="not-valid-b64!!", secret_key="test")
    assert len(s.master_key_bytes) == 32


def test_master_key_bytes_fallback_short_base64():
    # "changeme" is valid base64 but decodes to only 6 bytes → SHA-256 → 32 bytes
    s = Settings(master_key="changeme", secret_key="test")
    assert len(s.master_key_bytes) == 32


def test_master_key_bytes_deterministic():
    # Same input always produces the same key
    s = Settings(master_key="changeme", secret_key="test")
    assert s.master_key_bytes == s.master_key_bytes


def test_check_insecure_defaults_raises_on_secret_key_changeme():
    s = Settings(secret_key="changeme", master_key="anything")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        s.check_insecure_defaults()


def test_check_insecure_defaults_raises_on_master_key_changeme():
    s = Settings(secret_key="anything", master_key="changeme")
    with pytest.raises(RuntimeError, match="MASTER_KEY"):
        s.check_insecure_defaults()


def test_check_insecure_defaults_passes_with_valid_keys():
    good_key = base64.b64encode(b"x" * 32).decode()
    s = Settings(secret_key=good_key, master_key=good_key)
    s.check_insecure_defaults()  # must not raise
