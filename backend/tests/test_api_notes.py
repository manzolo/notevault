import pytest


async def test_create_note_minimal(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Minimal Note",
        "content": "",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Minimal Note"
    assert data["content"] == ""
    assert data["is_pinned"] is False
    assert data["category_id"] is None
    assert data["tags"] == []


async def test_create_note_with_content(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Full Note",
        "content": "Some content here",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Some content here"


async def test_create_note_pinned(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Pinned Note",
        "content": "",
        "is_pinned": True,
    }, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["is_pinned"] is True


async def test_list_notes_empty(client, auth_headers):
    response = await client.get("/api/notes", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_notes_returns_only_own(client, auth_headers, second_auth_headers):
    await client.post("/api/notes", json={"title": "User1 Note", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "User2 Note", "content": ""}, headers=second_auth_headers)

    response = await client.get("/api/notes", headers=auth_headers)
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["title"] == "User1 Note"


async def test_list_notes_pagination(client, auth_headers):
    for i in range(5):
        await client.post("/api/notes", json={"title": f"Note {i}", "content": ""}, headers=auth_headers)

    response = await client.get("/api/notes?page=1&per_page=3", headers=auth_headers)
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3
    assert data["pages"] == 2


async def test_get_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Get Me", "content": "Content"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == note_id
    assert response.json()["title"] == "Get Me"


async def test_get_note_not_found(client, auth_headers):
    response = await client.get("/api/notes/99999", headers=auth_headers)
    assert response.status_code == 404


async def test_update_note_title(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Original", "content": "Content"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"title": "Updated"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"
    assert response.json()["content"] == "Content"  # unchanged


async def test_update_note_pin(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Note", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"is_pinned": True}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_pinned"] is True


async def test_update_note_wrong_user(client, auth_headers, second_auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Mine", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"title": "Hacked"}, headers=second_auth_headers)
    assert response.status_code == 404


async def test_delete_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Delete Me", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.delete(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 204

    assert (await client.get(f"/api/notes/{note_id}", headers=auth_headers)).status_code == 404


async def test_delete_note_cascades_secrets(client, auth_headers):
    """Deleting a note must also delete its secrets (CASCADE)."""
    note_resp = await client.post("/api/notes", json={"title": "With Secret", "content": ""}, headers=auth_headers)
    note_id = note_resp.json()["id"]

    secret_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Key", "secret_type": "api_key", "value": "abc123",
    }, headers=auth_headers)
    assert secret_resp.status_code == 201
    secret_id = secret_resp.json()["id"]

    await client.delete(f"/api/notes/{note_id}", headers=auth_headers)

    # Secrets endpoint on a deleted note returns 404
    response = await client.get(f"/api/notes/{note_id}/secrets/{secret_id}", headers=auth_headers)
    assert response.status_code == 404


async def test_ownership_enforcement(client, auth_headers, second_auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Private", "content": "Secret"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    assert (await client.get(f"/api/notes/{note_id}", headers=second_auth_headers)).status_code == 404
    assert (await client.put(f"/api/notes/{note_id}", json={"title": "x"}, headers=second_auth_headers)).status_code == 404
    assert (await client.delete(f"/api/notes/{note_id}", headers=second_auth_headers)).status_code == 404


async def test_note_with_tags(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "python"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Tagged Note",
        "content": "",
        "tag_ids": [tag_id],
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    tags = note_resp.json()["tags"]
    assert len(tags) == 1
    assert tags[0]["name"] == "python"


async def test_note_with_category(client, auth_headers):
    cat_resp = await client.post("/api/categories", json={"name": "Work"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Work Note",
        "content": "",
        "category_id": cat_id,
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    assert note_resp.json()["category_id"] == cat_id


async def test_list_notes_filtered_by_tag(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "filteredtag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    tagged = await client.post("/api/notes", json={"title": "Tagged", "content": "", "tag_ids": [tag_id]}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Untagged", "content": ""}, headers=auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == tagged.json()["id"]


async def test_list_notes_filtered_by_tag_no_match(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "emptytag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    await client.post("/api/notes", json={"title": "Untagged", "content": ""}, headers=auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_list_notes_tag_filter_user_isolation(client, auth_headers, second_auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "isolatedtag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    await client.post("/api/notes", json={"title": "User A Note", "content": "", "tag_ids": [tag_id]}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "User B Note", "content": ""}, headers=second_auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=second_auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_list_notes_pinned_only(client, auth_headers):
    await client.post("/api/notes", json={"title": "Normal", "content": "", "is_pinned": False}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Pinned", "content": "", "is_pinned": True}, headers=auth_headers)

    response = await client.get("/api/notes?pinned_only=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Pinned"
    assert data["items"][0]["is_pinned"] is True


async def test_list_notes_pinned_sort_first(client, auth_headers):
    await client.post("/api/notes", json={"title": "Normal", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Pinned", "content": "", "is_pinned": True}, headers=auth_headers)

    response = await client.get("/api/notes", headers=auth_headers)
    items = response.json()["items"]
    assert items[0]["is_pinned"] is True
    assert items[0]["title"] == "Pinned"


async def test_create_note_default_not_archived(client, auth_headers):
    response = await client.post("/api/notes", json={"title": "Normal Note", "content": ""}, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["is_archived"] is False


async def test_archive_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "To Archive", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"is_archived": True}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is True

    # Unarchive
    response = await client.put(f"/api/notes/{note_id}", json={"is_archived": False}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is False


async def test_list_notes_excludes_archived_by_default(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    archived_resp = await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)
    archived_id = archived_resp.json()["id"]

    response = await client.get("/api/notes", headers=auth_headers)
    data = response.json()
    ids = [item["id"] for item in data["items"]]
    assert archived_id not in ids
    assert data["total"] == 1


async def test_list_notes_archived_only(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)

    response = await client.get("/api/notes?archived_only=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Archived"
    assert data["items"][0]["is_archived"] is True


async def test_list_notes_include_archived(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)

    response = await client.get("/api/notes?include_archived=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 2
