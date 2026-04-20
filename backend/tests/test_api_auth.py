import pytest


async def test_register_success(client):
    response = await client.post("/api/auth/register", json={
        "username": "newuser",
        "email": "newuser@test.com",
        "password": "password123",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_register_duplicate_username(client):
    payload = {"username": "dupuser", "email": "dup1@test.com", "password": "password123"}
    await client.post("/api/auth/register", json=payload)
    response = await client.post("/api/auth/register", json={
        **payload, "email": "dup2@test.com",
    })
    assert response.status_code == 409
    assert "Username" in response.json()["detail"]


async def test_register_duplicate_email(client):
    payload = {"username": "user1", "email": "shared@test.com", "password": "password123"}
    await client.post("/api/auth/register", json=payload)
    response = await client.post("/api/auth/register", json={
        **payload, "username": "user2",
    })
    assert response.status_code == 409
    assert "Email" in response.json()["detail"]


async def test_login_with_username(client):
    await client.post("/api/auth/register", json={
        "username": "loginuser",
        "email": "login@test.com",
        "password": "password123",
    })
    response = await client.post("/api/auth/login", json={
        "username": "loginuser",
        "password": "password123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_login_with_email(client):
    """Login using email in the username field must work."""
    await client.post("/api/auth/register", json={
        "username": "emailloginuser",
        "email": "emaillogin@test.com",
        "password": "password123",
    })
    response = await client.post("/api/auth/login", json={
        "username": "emaillogin@test.com",
        "password": "password123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json={
        "username": "loginuser2",
        "email": "login2@test.com",
        "password": "password123",
    })
    response = await client.post("/api/auth/login", json={
        "username": "loginuser2",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_nonexistent_user(client):
    response = await client.post("/api/auth/login", json={
        "username": "nobody",
        "password": "password123",
    })
    assert response.status_code == 401


async def test_me_returns_user_data(client, auth_headers):
    response = await client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"
    assert "hashed_password" not in data


async def test_me_requires_auth(client):
    response = await client.get("/api/auth/me")
    # FastAPI returns 403 when the Authorization header is missing entirely
    # (HTTPBearer scheme) and 401 when the token is invalid/expired
    assert response.status_code in (401, 403)


async def test_update_calendar_export_settings(client, auth_headers):
    response = await client.patch(
        "/api/auth/me/calendar-export",
        json={
            "ical_include_events": False,
            "ical_include_tasks": False,
            "ical_include_journal": True,
            "ical_include_field_dates": True,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ical_include_events"] is False
    assert data["ical_include_tasks"] is False
    assert data["ical_include_journal"] is True
    assert data["ical_include_field_dates"] is True
