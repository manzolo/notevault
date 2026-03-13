"""Tests for share visibility (public / users / specific) and events section."""
import pytest


async def _note(client, auth_headers, title="Visibility Test Note"):
    r = await client.post(
        "/api/notes",
        json={"title": title, "content": "Test content"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Visibility: public (default)
# ---------------------------------------------------------------------------

async def test_visibility_public_no_auth(client, auth_headers):
    """Public share link accessible without any auth."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "public"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 200
    assert r.json()["title"] == "Visibility Test Note"


async def test_visibility_public_with_auth(client, auth_headers, second_auth_headers):
    """Public share link also accessible when authenticated."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "public"},
        headers=auth_headers,
    )
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}", headers=second_auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Visibility: users (any logged-in user)
# ---------------------------------------------------------------------------

async def test_visibility_users_requires_auth(client, auth_headers):
    """'users' visibility requires a valid Bearer token."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "users"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    token = r.json()["token"]

    # Unauthenticated → 401
    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 401


async def test_visibility_users_authenticated_succeeds(client, auth_headers, second_auth_headers):
    """Any authenticated user can access a 'users' visibility link."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "users"},
        headers=auth_headers,
    )
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}", headers=second_auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Visibility: specific (only one allowed user)
# ---------------------------------------------------------------------------

async def _register_and_get_headers(client, username, email):
    r = await client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert r.status_code == 201
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    return headers, me.json()["id"]


async def test_visibility_specific_allowed_user_succeeds(client, auth_headers):
    """The specified allowed_user_id can access the 'specific' visibility link."""
    note_id = await _note(client, auth_headers)

    allowed_headers, allowed_id = await _register_and_get_headers(
        client, "alloweduser", "allowed@example.com"
    )

    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "specific", "allowed_user_id": allowed_id},
        headers=auth_headers,
    )
    assert r.status_code == 201
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}", headers=allowed_headers)
    assert r.status_code == 200


async def test_visibility_specific_other_user_forbidden(client, auth_headers, second_auth_headers):
    """A different authenticated user gets 403 on a 'specific' visibility link."""
    note_id = await _note(client, auth_headers)

    allowed_headers, allowed_id = await _register_and_get_headers(
        client, "alloweduser2", "allowed2@example.com"
    )

    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "specific", "allowed_user_id": allowed_id},
        headers=auth_headers,
    )
    token = r.json()["token"]

    # second_auth_headers is NOT the allowed user
    r = await client.get(f"/api/share/{token}", headers=second_auth_headers)
    assert r.status_code == 403


async def test_visibility_specific_no_auth_returns_401(client, auth_headers):
    """Unauthenticated request to 'specific' visibility link returns 401."""
    note_id = await _note(client, auth_headers)

    _, allowed_id = await _register_and_get_headers(
        client, "alloweduser3", "allowed3@example.com"
    )

    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "specific", "allowed_user_id": allowed_id},
        headers=auth_headers,
    )
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 401


async def test_visibility_specific_missing_allowed_user_id(client, auth_headers):
    """Creating 'specific' share without allowed_user_id returns 422."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "specific"},
        headers=auth_headers,
    )
    assert r.status_code == 422


async def test_visibility_invalid_value(client, auth_headers):
    """Invalid visibility value returns 422."""
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "nobody"},
        headers=auth_headers,
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Share status returns visibility fields
# ---------------------------------------------------------------------------

async def test_share_status_returns_visibility(client, auth_headers):
    """GET /api/notes/{id}/share returns visibility and allowed_user_id."""
    note_id = await _note(client, auth_headers)

    r = await client.get(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["visibility"] == "public"
    assert data["allowed_user_id"] is None

    await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "users"},
        headers=auth_headers,
    )
    r = await client.get(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.json()["visibility"] == "users"


# ---------------------------------------------------------------------------
# Events section
# ---------------------------------------------------------------------------

async def test_events_section_included_when_enabled(client, auth_headers):
    """When events section is enabled, events are returned in share response."""
    note_id = await _note(client, auth_headers)

    # Create an event on the note
    r = await client.post(
        f"/api/notes/{note_id}/events",
        json={
            "title": "Team Meeting",
            "start_datetime": "2026-04-01T10:00:00Z",
            "end_datetime": "2026-04-01T11:00:00Z",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201

    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"sections": {"content": True, "events": True}, "visibility": "public"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 200
    data = r.json()
    assert "events" in data
    assert len(data["events"]) == 1
    assert data["events"][0]["title"] == "Team Meeting"


async def test_events_section_excluded_by_default(client, auth_headers):
    """Events are not included when events section is not enabled."""
    note_id = await _note(client, auth_headers)

    r = await client.post(
        f"/api/notes/{note_id}/share",
        json={"visibility": "public"},
        headers=auth_headers,
    )
    token = r.json()["token"]

    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 200
    assert "events" not in r.json()


# ---------------------------------------------------------------------------
# User search endpoint
# ---------------------------------------------------------------------------

async def test_user_search_returns_matching_users(client, auth_headers, second_auth_headers):
    """GET /api/users/search?q=other returns the second user."""
    r = await client.get("/api/users/search?q=other", headers=auth_headers)
    assert r.status_code == 200
    results = r.json()
    assert any(u["username"] == "otheruser" for u in results)


async def test_user_search_excludes_self(client, auth_headers):
    """Search results never include the current user."""
    r = await client.get("/api/users/search?q=testuser", headers=auth_headers)
    assert r.status_code == 200
    results = r.json()
    assert not any(u["username"] == "testuser" for u in results)


async def test_user_search_requires_auth(client):
    """User search requires authentication."""
    r = await client.get("/api/users/search?q=user")
    assert r.status_code == 403


async def test_user_search_short_query_returns_empty(client, auth_headers):
    """Query shorter than 2 chars returns empty list."""
    r = await client.get("/api/users/search?q=a", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_user_search_by_email(client, auth_headers, second_auth_headers):
    """Can search users by partial email."""
    r = await client.get("/api/users/search?q=other@example", headers=auth_headers)
    assert r.status_code == 200
    results = r.json()
    assert any(u["email"] == "other@example.com" for u in results)
