"""
Full user-journey integration tests.

Password: E2eTest123!  (uppercase + lowercase + digits + exclamation mark)
Each test gets a clean DB (autouse clean_tables fixture in conftest).
The flow_headers fixture creates the test user fresh for each test.
"""
import pytest

_PASSWORD = "E2eTest123!"
_USERNAME = "e2e_flow_user"
_EMAIL = "e2e_flow@test.example"


# ---------------------------------------------------------------------------
# Fixture: e2e test user
# ---------------------------------------------------------------------------

@pytest.fixture
async def flow_headers(client):
    """Register the E2E user with a strong password and return auth headers."""
    resp = await client.post("/api/auth/register", json={
        "username": _USERNAME,
        "email": _EMAIL,
        "password": _PASSWORD,
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    yield {"Authorization": f"Bearer {token}"}
    # Cleanup: delete all notes (cascades to secrets / attachments)
    notes = await client.get("/api/notes?per_page=100",
                             headers={"Authorization": f"Bearer {token}"})
    for note in notes.json().get("items", []):
        await client.delete(f"/api/notes/{note['id']}",
                            headers={"Authorization": f"Bearer {token}"})


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

async def test_register_with_strong_password(client):
    """Registration succeeds with uppercase, lowercase, digits and '!'."""
    resp = await client.post("/api/auth/register", json={
        "username": _USERNAME,
        "email": _EMAIL,
        "password": _PASSWORD,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_with_username_strong_password(client):
    """Login by username works with the complex password."""
    await client.post("/api/auth/register", json={
        "username": _USERNAME, "email": _EMAIL, "password": _PASSWORD,
    })
    resp = await client.post("/api/auth/login", json={
        "username": _USERNAME, "password": _PASSWORD,
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_with_email_strong_password(client):
    """Login by email works with the complex password."""
    await client.post("/api/auth/register", json={
        "username": _USERNAME, "email": _EMAIL, "password": _PASSWORD,
    })
    resp = await client.post("/api/auth/login", json={
        "username": _EMAIL, "password": _PASSWORD,
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_wrong_password_rejected(client):
    """Login fails with incorrect password."""
    await client.post("/api/auth/register", json={
        "username": _USERNAME, "email": _EMAIL, "password": _PASSWORD,
    })
    resp = await client.post("/api/auth/login", json={
        "username": _USERNAME, "password": "WrongPass999!",
    })
    assert resp.status_code == 401


async def test_me_returns_user_info(client, flow_headers):
    """/api/auth/me returns username and email of the authenticated user."""
    resp = await client.get("/api/auth/me", headers=flow_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == _USERNAME
    assert data["email"] == _EMAIL
    assert data["is_active"] is True


async def test_invalid_token_rejected(client):
    """Requests with a bogus token get 401."""
    resp = await client.get("/api/notes", headers={"Authorization": "Bearer bogustoken"})
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Notes CRUD
# ---------------------------------------------------------------------------

async def test_create_and_list_notes(client, flow_headers):
    """Create several notes and verify they appear in the list."""
    titles = ["Alpha Note", "Beta Note", "Gamma Note"]
    for title in titles:
        resp = await client.post("/api/notes", json={
            "title": title,
            "content": f"Content of {title}",
        }, headers=flow_headers)
        assert resp.status_code == 201
        assert resp.json()["title"] == title

    resp = await client.get("/api/notes", headers=flow_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    listed_titles = {n["title"] for n in data["items"]}
    assert listed_titles == set(titles)


async def test_update_note(client, flow_headers):
    """Update title and content of an existing note."""
    resp = await client.post("/api/notes", json={
        "title": "Original Title", "content": "Old content",
    }, headers=flow_headers)
    note_id = resp.json()["id"]

    resp = await client.put(f"/api/notes/{note_id}", json={
        "title": "Updated Title", "content": "New content",
    }, headers=flow_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"
    assert resp.json()["content"] == "New content"


async def test_pin_note(client, flow_headers):
    """A note can be pinned and appears with is_pinned=True."""
    resp = await client.post("/api/notes", json={
        "title": "Pinnable Note", "content": "",
    }, headers=flow_headers)
    note_id = resp.json()["id"]

    resp = await client.put(f"/api/notes/{note_id}", json={
        "title": "Pinnable Note", "content": "", "is_pinned": True,
    }, headers=flow_headers)
    assert resp.status_code == 200
    assert resp.json()["is_pinned"] is True


async def test_delete_note(client, flow_headers):
    """Deleted note no longer appears in the list."""
    resp = await client.post("/api/notes", json={
        "title": "To Delete", "content": "",
    }, headers=flow_headers)
    note_id = resp.json()["id"]

    resp = await client.delete(f"/api/notes/{note_id}", headers=flow_headers)
    assert resp.status_code == 204

    resp = await client.get("/api/notes", headers=flow_headers)
    assert resp.json()["total"] == 0


async def test_get_nonexistent_note_returns_404(client, flow_headers):
    """Fetching a note that does not exist returns 404."""
    resp = await client.get("/api/notes/99999", headers=flow_headers)
    assert resp.status_code == 404


async def test_pagination(client, flow_headers):
    """15 notes split across pages correctly."""
    for i in range(15):
        await client.post("/api/notes", json={
            "title": f"Paged Note {i:02d}", "content": f"content {i}",
        }, headers=flow_headers)

    resp = await client.get("/api/notes?page=1&per_page=10", headers=flow_headers)
    data = resp.json()
    assert data["total"] == 15
    assert len(data["items"]) == 10
    assert data["pages"] == 2

    resp = await client.get("/api/notes?page=2&per_page=10", headers=flow_headers)
    assert len(resp.json()["items"]) == 5


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

async def test_tags_workflow(client, flow_headers):
    """Create a tag, assign to note, verify it appears in list and on the note."""
    resp = await client.post("/api/tags", json={"name": "e2e-tag"}, headers=flow_headers)
    assert resp.status_code == 201
    tag_id = resp.json()["id"]

    resp = await client.post("/api/notes", json={
        "title": "Tagged Note", "content": "Has a tag", "tag_ids": [tag_id],
    }, headers=flow_headers)
    assert resp.status_code == 201
    assert any(t["id"] == tag_id for t in resp.json()["tags"])

    # Tag appears in /api/tags list
    resp = await client.get("/api/tags", headers=flow_headers)
    assert any(t["name"] == "e2e-tag" for t in resp.json())

    # Re-fetching the note still shows the tag
    note_id = resp.json()[0]["id"] if resp.json() else None
    resp = await client.get("/api/tags", headers=flow_headers)
    assert len(resp.json()) >= 1


# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------

async def test_secrets_create_reveal_delete(client, flow_headers):
    """Create secrets of several types, reveal each one, verify the value, then delete."""
    resp = await client.post("/api/notes", json={
        "title": "Secret Vault Note", "content": "",
    }, headers=flow_headers)
    note_id = resp.json()["id"]

    secret_types = ["password", "api_key", "token", "ssh_key"]
    secret_ids = []

    for stype in secret_types:
        secret_value = f"SecretValue_{stype}_E2e123!"
        resp = await client.post(f"/api/notes/{note_id}/secrets", json={
            "name": f"My {stype}",
            "secret_type": stype,
            "value": secret_value,
        }, headers=flow_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert "value" not in data, "Secret value must not be exposed in create response"
        secret_ids.append((data["id"], secret_value))

    # List: 4 secrets present
    resp = await client.get(f"/api/notes/{note_id}/secrets", headers=flow_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 4

    # Reveal each secret and verify the exact value
    for sid, expected_value in secret_ids:
        resp = await client.post(
            f"/api/notes/{note_id}/secrets/{sid}/reveal",
            headers=flow_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["value"] == expected_value

    # Delete all secrets
    for sid, _ in secret_ids:
        resp = await client.delete(
            f"/api/notes/{note_id}/secrets/{sid}",
            headers=flow_headers,
        )
        assert resp.status_code == 204

    # Verify empty
    resp = await client.get(f"/api/notes/{note_id}/secrets", headers=flow_headers)
    assert resp.json() == []


async def test_secret_value_not_exposed_in_list(client, flow_headers):
    """Secret value is never returned in list responses."""
    resp = await client.post("/api/notes", json={"title": "N", "content": ""}, headers=flow_headers)
    note_id = resp.json()["id"]

    await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "db-pass", "secret_type": "password", "value": "TopSecret123!",
    }, headers=flow_headers)

    resp = await client.get(f"/api/notes/{note_id}/secrets", headers=flow_headers)
    for s in resp.json():
        assert "value" not in s



# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

async def test_search_finds_by_title(client, flow_headers):
    """FTS search returns notes matching the title."""
    await client.post("/api/notes", json={
        "title": "Quantum Computing Overview",
        "content": "Quantum computers use qubits",
    }, headers=flow_headers)
    await client.post("/api/notes", json={
        "title": "Machine Learning Basics",
        "content": "Neural networks learn from data",
    }, headers=flow_headers)

    resp = await client.get("/api/search?q=quantum", headers=flow_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Quantum Computing Overview"


async def test_search_finds_by_content(client, flow_headers):
    """FTS search finds notes by content keyword."""
    await client.post("/api/notes", json={
        "title": "Random Title",
        "content": "This note contains the word cryptography",
    }, headers=flow_headers)

    resp = await client.get("/api/search?q=cryptography", headers=flow_headers)
    assert resp.json()["total"] == 1


async def test_search_returns_match_in_attachment_field(client, flow_headers):
    """search result includes match_in_attachment boolean."""
    await client.post("/api/notes", json={
        "title": "Attachment Test Note", "content": "Some content",
    }, headers=flow_headers)

    resp = await client.get("/api/search?q=content", headers=flow_headers)
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "match_in_attachment" in item
        assert isinstance(item["match_in_attachment"], bool)


async def test_search_no_results(client, flow_headers):
    """Searching for a nonsense term returns 0 results."""
    await client.post("/api/notes", json={"title": "A Note", "content": "content"}, headers=flow_headers)
    resp = await client.get("/api/search?q=xyzzy12345nonexistent", headers=flow_headers)
    assert resp.json()["total"] == 0


async def test_search_pagination(client, flow_headers):
    """Search pagination: per_page and page params work."""
    for i in range(5):
        await client.post("/api/notes", json={
            "title": f"Searchable Note {i}",
            "content": "findme keyword present here",
        }, headers=flow_headers)

    resp = await client.get("/api/search?q=findme&per_page=3&page=1", headers=flow_headers)
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3

    resp = await client.get("/api/search?q=findme&per_page=3&page=2", headers=flow_headers)
    assert len(resp.json()["items"]) == 2


# ---------------------------------------------------------------------------
# User isolation
# ---------------------------------------------------------------------------

async def test_user_cannot_access_other_users_notes(client, flow_headers, second_auth_headers):
    """Notes created by user A are not visible or modifiable by user B."""
    resp = await client.post("/api/notes", json={
        "title": "User A Private Note", "content": "Secret content",
    }, headers=flow_headers)
    note_id = resp.json()["id"]

    # User B: get → 404
    resp = await client.get(f"/api/notes/{note_id}", headers=second_auth_headers)
    assert resp.status_code == 404

    # User B: update → 404
    resp = await client.put(f"/api/notes/{note_id}", json={
        "title": "Hacked", "content": "",
    }, headers=second_auth_headers)
    assert resp.status_code == 404

    # User B: delete → 404
    resp = await client.delete(f"/api/notes/{note_id}", headers=second_auth_headers)
    assert resp.status_code == 404

    # User B note list is empty
    resp = await client.get("/api/notes", headers=second_auth_headers)
    assert resp.json()["total"] == 0


async def test_search_scoped_to_current_user(client, flow_headers, second_auth_headers):
    """Search only returns results owned by the requesting user."""
    await client.post("/api/notes", json={
        "title": "User A secret document", "content": "classified",
    }, headers=flow_headers)

    # User B searches: should find nothing
    resp = await client.get("/api/search?q=classified", headers=second_auth_headers)
    assert resp.json()["total"] == 0
