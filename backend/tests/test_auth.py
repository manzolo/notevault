import pytest
from datetime import timedelta
from app.security.auth import hash_password, verify_password, create_access_token, verify_token


def test_hash_and_verify_password():
    password = "mysecretpassword"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)


def test_verify_wrong_password():
    hashed = hash_password("correct")
    assert not verify_password("wrong", hashed)


def test_bcrypt_different_hashes():
    # Same password hashes to different values (salt)
    h1 = hash_password("password")
    h2 = hash_password("password")
    assert h1 != h2


def test_create_and_verify_token():
    token = create_access_token({"sub": "42"})
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "42"


def test_verify_expired_token():
    token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
    payload = verify_token(token)
    assert payload is None


def test_verify_invalid_token():
    payload = verify_token("not.a.valid.token")
    assert payload is None
