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
