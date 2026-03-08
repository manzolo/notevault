import pyotp
from app.security.encryption import get_encryption


def generate_totp_secret() -> str:
    """Generate a random base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "NoteVault") -> str:
    """Return the otpauth:// URI used to provision authenticator apps."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code. Allows ±1 window (30 s) of clock drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def encrypt_totp_secret(secret: str) -> bytes:
    return get_encryption().encrypt(secret)


def decrypt_totp_secret(blob: bytes) -> str:
    return get_encryption().decrypt(blob)
