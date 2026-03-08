import pytest


@pytest.mark.asyncio
async def test_search_by_title(client, auth_headers):
    await client.post("/api/notes", json={
        "title": "Python Programming Guide",
        "content": "Learn Python",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=Python", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    titles = [n["title"] for n in data["items"]]
    assert any("Python" in t for t in titles)


@pytest.mark.asyncio
async def test_search_by_content(client, auth_headers):
    await client.post("/api/notes", json={
        "title": "My Note",
        "content": "This contains the word unicorn for searching",
    }, headers=auth_headers)

    response = await client.get("/api/search?q=unicorn", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 1


@pytest.mark.asyncio
async def test_search_own_notes_only(client, auth_headers, second_auth_headers):
    await client.post("/api/notes", json={
        "title": "User1 dragon note",
        "content": "dragon content",
    }, headers=auth_headers)

    # Other user searches - should not see user1's notes
    response = await client.get("/api/search?q=dragon", headers=second_auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0


@pytest.mark.asyncio
async def test_search_empty_query(client, auth_headers):
    response = await client.get("/api/search?q=", headers=auth_headers)
    assert response.status_code == 422
