import pytest


@pytest.mark.asyncio
async def test_create_note(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Test Note",
        "content": "Hello world",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Note"
    assert data["content"] == "Hello world"


@pytest.mark.asyncio
async def test_list_notes(client, auth_headers):
    await client.post("/api/notes", json={"title": "Note 1", "content": "Content 1"}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Note 2", "content": "Content 2"}, headers=auth_headers)

    response = await client.get("/api/notes", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_get_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={
        "title": "Get Me",
        "content": "Content",
    }, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == note_id


@pytest.mark.asyncio
async def test_update_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={
        "title": "Original",
        "content": "Original content",
    }, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={
        "title": "Updated",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"


@pytest.mark.asyncio
async def test_delete_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={
        "title": "Delete Me",
        "content": "Content",
    }, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.delete(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 204

    get_response = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_ownership_enforcement(client, auth_headers, second_auth_headers):
    create_resp = await client.post("/api/notes", json={
        "title": "Private Note",
        "content": "Secret",
    }, headers=auth_headers)
    note_id = create_resp.json()["id"]

    # Other user cannot access
    response = await client.get(f"/api/notes/{note_id}", headers=second_auth_headers)
    assert response.status_code == 404
