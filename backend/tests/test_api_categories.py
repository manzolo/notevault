import pytest


async def test_create_root_category(client, auth_headers):
    response = await client.post("/api/categories", json={"name": "Root"}, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Root"
    assert data["parent_id"] is None
    assert data["children"] == []


async def test_create_subcategory(client, auth_headers):
    parent_resp = await client.post("/api/categories", json={"name": "Parent"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]

    child_resp = await client.post(
        "/api/categories",
        json={"name": "Child", "parent_id": parent_id},
        headers=auth_headers,
    )
    assert child_resp.status_code == 201
    data = child_resp.json()
    assert data["parent_id"] == parent_id
    assert data["name"] == "Child"


async def test_create_subcategory_foreign_parent(client, auth_headers, second_auth_headers):
    """Creating a subcategory under another user's parent should return 404."""
    parent_resp = await client.post("/api/categories", json={"name": "OtherParent"}, headers=second_auth_headers)
    other_parent_id = parent_resp.json()["id"]

    response = await client.post(
        "/api/categories",
        json={"name": "Child", "parent_id": other_parent_id},
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_get_categories_tree(client, auth_headers):
    parent_resp = await client.post("/api/categories", json={"name": "ParentTree"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]
    await client.post(
        "/api/categories",
        json={"name": "Child1", "parent_id": parent_id},
        headers=auth_headers,
    )
    await client.post(
        "/api/categories",
        json={"name": "Child2", "parent_id": parent_id},
        headers=auth_headers,
    )

    response = await client.get("/api/categories", headers=auth_headers)
    assert response.status_code == 200
    roots = response.json()
    parent_node = next((c for c in roots if c["id"] == parent_id), None)
    assert parent_node is not None
    child_names = [c["name"] for c in parent_node["children"]]
    assert "Child1" in child_names
    assert "Child2" in child_names


async def test_update_category_rename(client, auth_headers):
    cat_resp = await client.post("/api/categories", json={"name": "OldName"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    response = await client.patch(
        f"/api/categories/{cat_id}",
        json={"name": "NewName"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "NewName"


async def test_update_category_reparent(client, auth_headers):
    parent_resp = await client.post("/api/categories", json={"name": "ParentRep"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]
    child_resp = await client.post("/api/categories", json={"name": "ChildRep"}, headers=auth_headers)
    child_id = child_resp.json()["id"]

    response = await client.patch(
        f"/api/categories/{child_id}",
        json={"parent_id": parent_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["parent_id"] == parent_id


async def test_update_category_circular(client, auth_headers):
    """Setting a descendant as parent should return 400."""
    parent_resp = await client.post("/api/categories", json={"name": "Ancestor"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]
    child_resp = await client.post(
        "/api/categories",
        json={"name": "Descendant", "parent_id": parent_id},
        headers=auth_headers,
    )
    child_id = child_resp.json()["id"]

    # Try to set ancestor's parent to the descendant (circular)
    response = await client.patch(
        f"/api/categories/{parent_id}",
        json={"parent_id": child_id},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_delete_category_notes_unfiled(client, auth_headers):
    """Notes in deleted folder should become unfiled (category_id = NULL)."""
    cat_resp = await client.post("/api/categories", json={"name": "ToDelete"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    note_resp = await client.post(
        "/api/notes",
        json={"title": "Filed Note", "content": "test", "category_id": cat_id},
        headers=auth_headers,
    )
    note_id = note_resp.json()["id"]

    del_resp = await client.delete(f"/api/categories/{cat_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert get_resp.json()["category_id"] is None


async def test_delete_category_children_reparented(client, auth_headers):
    """Children of deleted folder should be re-parented to deleted folder's parent."""
    parent_resp = await client.post("/api/categories", json={"name": "GrandParent"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]
    mid_resp = await client.post(
        "/api/categories",
        json={"name": "Middle", "parent_id": parent_id},
        headers=auth_headers,
    )
    mid_id = mid_resp.json()["id"]
    child_resp = await client.post(
        "/api/categories",
        json={"name": "ChildOfMiddle", "parent_id": mid_id},
        headers=auth_headers,
    )
    child_id = child_resp.json()["id"]

    # Delete middle → child should become direct child of grandparent
    del_resp = await client.delete(f"/api/categories/{mid_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Fetch tree and check child is now under grandparent
    tree_resp = await client.get("/api/categories", headers=auth_headers)
    roots = tree_resp.json()
    gp_node = next((c for c in roots if c["id"] == parent_id), None)
    assert gp_node is not None
    child_ids = [c["id"] for c in gp_node["children"]]
    assert child_id in child_ids


async def test_notes_filter_exact_category(client, auth_headers):
    """Filtering by category_id returns only notes directly in that folder (not descendants)."""
    parent_resp = await client.post("/api/categories", json={"name": "FilterParent"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]
    child_resp = await client.post(
        "/api/categories",
        json={"name": "FilterChild", "parent_id": parent_id},
        headers=auth_headers,
    )
    child_id = child_resp.json()["id"]

    n1 = await client.post(
        "/api/notes",
        json={"title": "Parent Note", "content": "test", "category_id": parent_id},
        headers=auth_headers,
    )
    n2 = await client.post(
        "/api/notes",
        json={"title": "Child Note", "content": "test", "category_id": child_id},
        headers=auth_headers,
    )

    # Filter by parent: only n1
    resp_parent = await client.get(f"/api/notes?category_id={parent_id}", headers=auth_headers)
    assert resp_parent.status_code == 200
    ids_parent = [item["id"] for item in resp_parent.json()["items"]]
    assert n1.json()["id"] in ids_parent
    assert n2.json()["id"] not in ids_parent

    # Filter by child: only n2
    resp_child = await client.get(f"/api/notes?category_id={child_id}", headers=auth_headers)
    assert resp_child.status_code == 200
    ids_child = [item["id"] for item in resp_child.json()["items"]]
    assert n2.json()["id"] in ids_child
    assert n1.json()["id"] not in ids_child


async def test_notes_filter_unfiled(client, auth_headers):
    """unfiled=true returns only notes with no folder assigned."""
    cat_resp = await client.post("/api/categories", json={"name": "SomeFolder"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    n_filed = await client.post(
        "/api/notes",
        json={"title": "Filed Note", "content": "test", "category_id": cat_id},
        headers=auth_headers,
    )
    n_unfiled = await client.post(
        "/api/notes",
        json={"title": "Unfiled Note", "content": "test"},
        headers=auth_headers,
    )

    response = await client.get("/api/notes?unfiled=true", headers=auth_headers)
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert n_unfiled.json()["id"] in ids
    assert n_filed.json()["id"] not in ids


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
