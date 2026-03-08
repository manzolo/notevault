import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import get_settings

settings = get_settings()

NONCE_SIZE = 12  # bytes for AES-256-GCM


class SecretEncryption:
    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("Encryption key must be exactly 32 bytes")
        self._key = key

    def encrypt(self, plaintext: str) -> bytes:
        """Encrypt plaintext string. Returns nonce(12B) || ciphertext."""
        nonce = os.urandom(NONCE_SIZE)
        aesgcm = AESGCM(self._key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
        return nonce + ciphertext

    def decrypt(self, blob: bytes) -> str:
        """Decrypt blob of nonce(12B) || ciphertext. Returns plaintext string."""
        if len(blob) < NONCE_SIZE:
            raise ValueError("Encrypted blob too short")
        nonce = blob[:NONCE_SIZE]
        ciphertext = blob[NONCE_SIZE:]
        aesgcm = AESGCM(self._key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')


# Module-level singleton, initialized with the master key
_encryption_instance: SecretEncryption | None = None


def get_encryption() -> SecretEncryption:
    global _encryption_instance
    if _encryption_instance is None:
        _encryption_instance = SecretEncryption(settings.master_key_bytes)
    return _encryption_instance
