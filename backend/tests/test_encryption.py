import base64
import pytest
from app.security.encryption import SecretEncryption

VALID_KEY = b"a" * 32  # 32 bytes


def test_encrypt_decrypt_roundtrip():
    enc = SecretEncryption(VALID_KEY)
    plaintext = "my secret value"
    blob = enc.encrypt(plaintext)
    assert enc.decrypt(blob) == plaintext


def test_nonce_randomness():
    enc = SecretEncryption(VALID_KEY)
    blob1 = enc.encrypt("same value")
    blob2 = enc.encrypt("same value")
    # Different nonces each time
    assert blob1[:12] != blob2[:12]
    # But both decrypt correctly
    assert enc.decrypt(blob1) == "same value"
    assert enc.decrypt(blob2) == "same value"


def test_wrong_key_raises():
    enc1 = SecretEncryption(VALID_KEY)
    enc2 = SecretEncryption(b"b" * 32)
    blob = enc1.encrypt("secret")
    with pytest.raises(Exception):
        enc2.decrypt(blob)


def test_invalid_key_length():
    with pytest.raises(ValueError):
        SecretEncryption(b"too_short")


def test_blob_too_short():
    enc = SecretEncryption(VALID_KEY)
    with pytest.raises(ValueError):
        enc.decrypt(b"short")


def test_unicode_roundtrip():
    enc = SecretEncryption(VALID_KEY)
    plaintext = "こんにちは 🔐 secret"
    assert enc.decrypt(enc.encrypt(plaintext)) == plaintext
