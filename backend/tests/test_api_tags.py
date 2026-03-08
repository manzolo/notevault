import pytest


async def test_create_tag(client, auth_headers):
    response = await client.post("/api/tags", json={"name": "python"}, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "python"
    assert "id" in data


async def test_create_duplicate_tag_is_idempotent(client, auth_headers):
    """Creating a tag that already exists returns the existing one (no 409)."""
    r1 = await client.post("/api/tags", json={"name": "devops"}, headers=auth_headers)
    r2 = await client.post("/api/tags", json={"name": "devops"}, headers=auth_headers)
    assert r1.status_code == 201
    # Returns existing — either 200 or 201, but same id
    assert r2.json()["id"] == r1.json()["id"]
    assert r2.json()["name"] == "devops"


async def test_list_tags(client, auth_headers):
    await client.post("/api/tags", json={"name": "backend"}, headers=auth_headers)
    await client.post("/api/tags", json={"name": "frontend"}, headers=auth_headers)

    response = await client.get("/api/tags", headers=auth_headers)
    assert response.status_code == 200
    names = [t["name"] for t in response.json()]
    assert "backend" in names
    assert "frontend" in names
    assert names == sorted(names)  # ordered alphabetically


async def test_list_tags_empty(client, auth_headers):
    response = await client.get("/api/tags", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_tags_isolated_per_user(client, auth_headers, second_auth_headers):
    await client.post("/api/tags", json={"name": "user1-tag"}, headers=auth_headers)

    response = await client.get("/api/tags", headers=second_auth_headers)
    assert response.json() == []


async def test_same_tag_name_different_users(client, auth_headers, second_auth_headers):
    r1 = await client.post("/api/tags", json={"name": "common"}, headers=auth_headers)
    r2 = await client.post("/api/tags", json={"name": "common"}, headers=second_auth_headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


async def test_note_with_multiple_tags(client, auth_headers):
    t1 = (await client.post("/api/tags", json={"name": "alpha"}, headers=auth_headers)).json()["id"]
    t2 = (await client.post("/api/tags", json={"name": "beta"}, headers=auth_headers)).json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Multi-tag Note",
        "content": "",
        "tag_ids": [t1, t2],
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    tag_names = {t["name"] for t in note_resp.json()["tags"]}
    assert tag_names == {"alpha", "beta"}


async def test_update_note_tags(client, auth_headers):
    t1 = (await client.post("/api/tags", json={"name": "old"}, headers=auth_headers)).json()["id"]
    t2 = (await client.post("/api/tags", json={"name": "new"}, headers=auth_headers)).json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Tag Update Note",
        "content": "",
        "tag_ids": [t1],
    }, headers=auth_headers)
    note_id = note_resp.json()["id"]

    update_resp = await client.put(f"/api/notes/{note_id}", json={"tag_ids": [t2]}, headers=auth_headers)
    assert update_resp.status_code == 200
    tag_names = {t["name"] for t in update_resp.json()["tags"]}
    assert tag_names == {"new"}
