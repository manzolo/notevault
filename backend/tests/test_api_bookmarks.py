"""Tests for bookmark CRUD, ownership, tag operations, and FTS search."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_note(client: AsyncClient, headers: dict, title: str = "Test Note") -> dict:
    resp = await client.post("/api/notes", json={"title": title, "content": "content"}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _create_tag(client: AsyncClient, headers: dict, name: str = "tag1") -> dict:
    resp = await client.post("/api/tags", json={"name": name}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bookmark(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://example.com", "title": "Example", "description": "A sample site"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["url"] == "https://example.com"
    assert data["title"] == "Example"
    assert data["description"] == "A sample site"
    assert data["note_id"] == note["id"]
    assert data["tags"] == []


@pytest.mark.asyncio
async def test_list_bookmarks(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://one.com", "title": "One"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://two.com", "title": "Two"},
        headers=auth_headers,
    )
    resp = await client.get(f"/api/notes/{note['id']}/bookmarks", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_bookmark(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    create_resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://old.com", "title": "Old"},
        headers=auth_headers,
    )
    bm_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/notes/{note['id']}/bookmarks/{bm_id}",
        json={"url": "https://new.com", "title": "New", "description": "Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["url"] == "https://new.com"
    assert data["title"] == "New"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_delete_bookmark(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    create_resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://delete.me"},
        headers=auth_headers,
    )
    bm_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/notes/{note['id']}/bookmarks/{bm_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    list_resp = await client.get(f"/api/notes/{note['id']}/bookmarks", headers=auth_headers)
    assert list_resp.json() == []


# ---------------------------------------------------------------------------
# Ownership
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_create_bookmark_on_other_users_note(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://hack.com"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_list_bookmarks_of_other_users_note(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    resp = await client.get(
        f"/api/notes/{note['id']}/bookmarks",
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_update_other_users_bookmark(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    create_resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://mine.com"},
        headers=auth_headers,
    )
    bm_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/notes/{note['id']}/bookmarks/{bm_id}",
        json={"url": "https://hacked.com"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tag operations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bookmark_with_tags(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    tag = await _create_tag(client, auth_headers, "python")

    resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://python.org", "tag_ids": [tag["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["tags"]) == 1
    assert data["tags"][0]["id"] == tag["id"]


@pytest.mark.asyncio
async def test_update_bookmark_tags(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    tag1 = await _create_tag(client, auth_headers, "alpha")
    tag2 = await _create_tag(client, auth_headers, "beta")

    create_resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://site.com", "tag_ids": [tag1["id"]]},
        headers=auth_headers,
    )
    bm_id = create_resp.json()["id"]

    # Replace tag1 with tag2
    resp = await client.put(
        f"/api/notes/{note['id']}/bookmarks/{bm_id}",
        json={"tag_ids": [tag2["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    tags = resp.json()["tags"]
    assert len(tags) == 1
    assert tags[0]["id"] == tag2["id"]


@pytest.mark.asyncio
async def test_tag_ownership_enforced(client: AsyncClient, auth_headers: dict, second_auth_headers: dict):
    """Tags owned by another user must be silently ignored."""
    note = await _create_note(client, auth_headers)
    # Tag belongs to user2
    other_tag = await _create_tag(client, second_auth_headers, "other_tag")

    resp = await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://safe.com", "tag_ids": [other_tag["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    # Tag should not be attached (not owned by user1)
    assert resp.json()["tags"] == []


# ---------------------------------------------------------------------------
# FTS search
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bookmark_fts_search_by_title(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://unique.com", "title": "uniquekeyword"},
        headers=auth_headers,
    )
    resp = await client.get("/api/search?q=uniquekeyword", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    found = next((i for i in data["items"] if i["id"] == note["id"]), None)
    assert found is not None
    assert found["match_in_bookmark"] is True


@pytest.mark.asyncio
async def test_bookmark_fts_search_by_description(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    await client.post(
        f"/api/notes/{note['id']}/bookmarks",
        json={"url": "https://desc.com", "description": "rareterm12345"},
        headers=auth_headers,
    )
    resp = await client.get("/api/search?q=rareterm12345", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    found = next((i for i in data["items"] if i["id"] == note["id"]), None)
    assert found is not None
    assert found["match_in_bookmark"] is True


@pytest.mark.asyncio
async def test_search_response_has_pagination(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers, title="paginationtest")
    resp = await client.get("/api/search?q=paginationtest&page=1&per_page=20", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "page" in data
    assert "per_page" in data
    assert "pages" in data
    assert data["page"] == 1
    assert data["per_page"] == 20
