import pytest


async def test_create_category(client, auth_headers):
    response = await client.post("/api/categories", json={"name": "Work"}, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Work"
    assert "id" in data
    assert "created_at" in data


async def test_create_duplicate_category(client, auth_headers):
    await client.post("/api/categories", json={"name": "Work"}, headers=auth_headers)
    response = await client.post("/api/categories", json={"name": "Work"}, headers=auth_headers)
    assert response.status_code == 409


async def test_list_categories(client, auth_headers):
    await client.post("/api/categories", json={"name": "Zebra"}, headers=auth_headers)
    await client.post("/api/categories", json={"name": "Alpha"}, headers=auth_headers)

    response = await client.get("/api/categories", headers=auth_headers)
    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    assert "Zebra" in names
    assert "Alpha" in names
    # Should be sorted alphabetically
    assert names == sorted(names)


async def test_list_categories_empty(client, auth_headers):
    response = await client.get("/api/categories", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_categories_isolated_per_user(client, auth_headers, second_auth_headers):
    await client.post("/api/categories", json={"name": "User1 Category"}, headers=auth_headers)

    response = await client.get("/api/categories", headers=second_auth_headers)
    assert response.json() == []


async def test_same_category_name_different_users(client, auth_headers, second_auth_headers):
    """Two users can have categories with the same name."""
    r1 = await client.post("/api/categories", json={"name": "Personal"}, headers=auth_headers)
    r2 = await client.post("/api/categories", json={"name": "Personal"}, headers=second_auth_headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


async def test_assign_category_to_note(client, auth_headers):
    cat_resp = await client.post("/api/categories", json={"name": "Recipes"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Pasta Recipe",
        "content": "Boil water",
        "category_id": cat_id,
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    assert note_resp.json()["category_id"] == cat_id

    # Verify via GET
    note_id = note_resp.json()["id"]
    get_resp = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert get_resp.json()["category_id"] == cat_id
