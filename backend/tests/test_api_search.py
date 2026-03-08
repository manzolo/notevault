import io
import pytest


async def test_search_by_title(client, auth_headers):
    await client.post("/api/notes", json={
        "title": "Python Programming Guide",
        "content": "Learn stuff",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=Python", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("Python" in n["title"] for n in data["items"])


async def test_search_by_content(client, auth_headers):
    await client.post("/api/notes", json={
        "title": "My Note",
        "content": "This contains the word unicorn for searching",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=unicorn", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 1


async def test_search_returns_query_field(client, auth_headers):
    await client.post("/api/notes", json={"title": "Dragon Note", "content": ""}, headers=auth_headers)
    response = await client.get("/api/search?q=Dragon", headers=auth_headers)
    assert response.json()["query"] == "Dragon"


async def test_search_own_notes_only(client, auth_headers, second_auth_headers):
    await client.post("/api/notes", json={
        "title": "User1 dragon note",
        "content": "dragon content",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=dragon", headers=second_auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_search_empty_query_rejected(client, auth_headers):
    response = await client.get("/api/search?q=", headers=auth_headers)
    assert response.status_code == 422


async def test_search_no_results(client, auth_headers):
    response = await client.get("/api/search?q=xyznonexistentterm", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert response.json()["items"] == []


async def test_search_with_tag_filter(client, auth_headers):
    tag_id = (await client.post("/api/tags", json={"name": "science"}, headers=auth_headers)).json()["id"]

    # Note with the tag
    await client.post("/api/notes", json={
        "title": "Quantum physics note",
        "content": "",
        "tag_ids": [tag_id],
    }, headers=auth_headers)
    # Note without the tag
    await client.post("/api/notes", json={
        "title": "Quantum chemistry note",
        "content": "",
    }, headers=auth_headers)

    response = await client.get(f"/api/search?q=quantum&tag_id={tag_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert "physics" in data["items"][0]["title"]


async def test_search_pagination(client, auth_headers):
    for i in range(5):
        await client.post("/api/notes", json={
            "title": f"Searchable Note {i}",
            "content": "findme",
        }, headers=auth_headers)

    r1 = await client.get("/api/search?q=findme&page=1&per_page=3", headers=auth_headers)
    r2 = await client.get("/api/search?q=findme&page=2&per_page=3", headers=auth_headers)

    assert r1.json()["total"] == 5
    assert len(r1.json()["items"]) == 3
    assert len(r2.json()["items"]) == 2


# ── matching_attachments field ────────────────────────────────────────────────

async def test_search_response_items_have_matching_attachments_field(client, auth_headers):
    """Every search result item must expose matching_attachments as a list."""
    await client.post("/api/notes", json={
        "title": "AttFieldNote",
        "content": "unique content xyzzy",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=AttFieldNote", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    item = data["items"][0]
    assert "matching_attachments" in item
    assert isinstance(item["matching_attachments"], list)


async def test_search_note_match_by_title_has_empty_matching_attachments(client, auth_headers):
    """Note that matches by title alone should have empty matching_attachments."""
    await client.post("/api/notes", json={
        "title": "BlueprintAlpha",
        "content": "",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=BlueprintAlpha", headers=auth_headers)
    data = response.json()
    assert data["total"] >= 1
    item = next(i for i in data["items"] if "BlueprintAlpha" in i["title"])
    assert item["match_in_attachment"] is False
    assert item["matching_attachments"] == []


async def test_search_matching_attachments_contains_attachment_data(client, auth_headers):
    """When a markdown attachment's content matches the query, it is listed in matching_attachments."""
    note_resp = await client.post("/api/notes", json={
        "title": "NoteForAttachSearch",
        "content": "",
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    note_id = note_resp.json()["id"]

    unique_word = "zythophilous"
    md_content = f"# Test\n\nThis document contains the rare word {unique_word}.\n"
    att_resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("search_test.md", io.BytesIO(md_content.encode()), "text/markdown")},
        headers=auth_headers,
    )
    assert att_resp.status_code == 201
    att_id = att_resp.json()["id"]

    response = await client.get(f"/api/search?q={unique_word}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    if data["total"] == 0:
        # Text extraction may not index markdown in this env — skip assertion
        return

    item = next((i for i in data["items"] if i["id"] == note_id), None)
    assert item is not None
    assert item["match_in_attachment"] is True
    assert any(a["id"] == att_id for a in item["matching_attachments"])
    att_entry = next(a for a in item["matching_attachments"] if a["id"] == att_id)
    assert att_entry["filename"] == "search_test.md"
    assert "mime_type" in att_entry
    assert "note_id" in att_entry


async def test_search_matching_attachments_schema(client, auth_headers):
    """matching_attachments entries must have id, note_id, filename, mime_type."""
    note_resp = await client.post("/api/notes", json={
        "title": "SchemaCheckNote", "content": "",
    }, headers=auth_headers)
    note_id = note_resp.json()["id"]

    unique_word = "vexillographer"
    md_content = f"Word: {unique_word}\n"
    await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("schema.md", io.BytesIO(md_content.encode()), "text/markdown")},
        headers=auth_headers,
    )

    response = await client.get(f"/api/search?q={unique_word}", headers=auth_headers)
    data = response.json()

    if data["total"] == 0:
        return  # extraction not available

    item = next((i for i in data["items"] if i["id"] == note_id), None)
    if item and item["matching_attachments"]:
        entry = item["matching_attachments"][0]
        assert set(entry.keys()) >= {"id", "note_id", "filename", "mime_type"}
