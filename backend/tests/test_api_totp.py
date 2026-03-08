"""Tests for TOTP endpoints."""
import pyotp
import pytest
from httpx import AsyncClient
from app.config import get_settings


@pytest.fixture(autouse=True)
def force_totp_required():
    """Force totp_required=True for all tests in this module."""
    settings = get_settings()
    original = settings.totp_required
    settings.totp_required = True
    yield
    settings.totp_required = original


@pytest.fixture
async def registered_user(client: AsyncClient):
    """Register and return credentials + auth headers."""
    resp = await client.post("/api/auth/register", json={
        "username": "totpuser",
        "email": "totp@example.com",
        "password": "securepassword123",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "password": "securepassword123"}


async def test_setup_returns_secret_and_uri(client: AsyncClient, registered_user):
    resp = await client.post("/api/auth/totp/setup", headers=registered_user["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert "secret" in data
    assert "otpauth_url" in data
    assert data["otpauth_url"].startswith("otpauth://totp/")


async def test_enable_totp_with_valid_code(client: AsyncClient, registered_user):
    # Get a fresh secret
    setup_resp = await client.post("/api/auth/totp/setup", headers=registered_user["headers"])
    secret = setup_resp.json()["secret"]

    # Generate a valid TOTP code
    code = pyotp.TOTP(secret).now()

    resp = await client.post("/api/auth/totp/enable", headers=registered_user["headers"], json={
        "secret": secret, "code": code,
    })
    assert resp.status_code == 200
    assert resp.json()["totp_enabled"] is True


async def test_enable_totp_with_invalid_code(client: AsyncClient, registered_user):
    setup_resp = await client.post("/api/auth/totp/setup", headers=registered_user["headers"])
    secret = setup_resp.json()["secret"]

    resp = await client.post("/api/auth/totp/enable", headers=registered_user["headers"], json={
        "secret": secret, "code": "000000",
    })
    assert resp.status_code == 400


async def _enable_totp_for_user(client: AsyncClient, headers: dict) -> str:
    """Helper: enable TOTP and return the plaintext secret."""
    setup_resp = await client.post("/api/auth/totp/setup", headers=headers)
    secret = setup_resp.json()["secret"]
    code = pyotp.TOTP(secret).now()
    resp = await client.post("/api/auth/totp/enable", headers=headers, json={
        "secret": secret, "code": code,
    })
    assert resp.status_code == 200
    return secret


async def test_login_returns_totp_required_when_enabled(client: AsyncClient, registered_user):
    await _enable_totp_for_user(client, registered_user["headers"])

    resp = await client.post("/api/auth/login", json={
        "username": "totpuser", "password": "securepassword123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["totp_required"] is True
    assert data["partial_token"] is not None
    assert data["access_token"] is None


async def test_totp_verify_full_flow(client: AsyncClient, registered_user):
    secret = await _enable_totp_for_user(client, registered_user["headers"])

    # Login → get partial token
    login_resp = await client.post("/api/auth/login", json={
        "username": "totpuser", "password": "securepassword123",
    })
    partial_token = login_resp.json()["partial_token"]

    # Verify TOTP → get full token
    code = pyotp.TOTP(secret).now()
    verify_resp = await client.post("/api/auth/totp/verify", json={
        "partial_token": partial_token, "code": code,
    })
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


async def test_totp_verify_invalid_code(client: AsyncClient, registered_user):
    await _enable_totp_for_user(client, registered_user["headers"])

    login_resp = await client.post("/api/auth/login", json={
        "username": "totpuser", "password": "securepassword123",
    })
    partial_token = login_resp.json()["partial_token"]

    resp = await client.post("/api/auth/totp/verify", json={
        "partial_token": partial_token, "code": "000000",
    })
    assert resp.status_code == 401


async def test_disable_totp_with_correct_password(client: AsyncClient, registered_user):
    await _enable_totp_for_user(client, registered_user["headers"])

    resp = await client.post("/api/auth/totp/disable", headers=registered_user["headers"], json={
        "password": registered_user["password"],
    })
    assert resp.status_code == 200
    assert resp.json()["totp_enabled"] is False


async def test_disable_totp_with_wrong_password(client: AsyncClient, registered_user):
    await _enable_totp_for_user(client, registered_user["headers"])

    resp = await client.post("/api/auth/totp/disable", headers=registered_user["headers"], json={
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


async def test_me_includes_totp_enabled(client: AsyncClient, registered_user):
    resp = await client.get("/api/auth/me", headers=registered_user["headers"])
    assert resp.status_code == 200
    assert "totp_enabled" in resp.json()
    assert resp.json()["totp_enabled"] is False
