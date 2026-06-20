import io
import zipfile

import pytest
import pytest_asyncio

# Minimal valid JPEG for magic-byte detection on upload
_JPEG_BYTES = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
]) + b"\x00" * 108 + bytes([0xFF, 0xD9])


@pytest_asyncio.fixture
async def note_id(client, auth_headers):
    resp = await client.post(
        "/api/notes",
        json={"title": "Folder Note", "content": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _upload(client, auth_headers, note_id, name="img.jpg"):
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": (name, io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


async def test_create_root_folder(client, auth_headers, note_id):
    resp = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Contracts"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Contracts"
    assert data["note_id"] == note_id
    assert data["parent_id"] is None
    assert data["children"] == []


async def test_create_nested_folder(client, auth_headers, note_id):
    parent = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "2026"},
        headers=auth_headers,
    )
    parent_id = parent.json()["id"]
    child = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Q1", "parent_id": parent_id},
        headers=auth_headers,
    )
    assert child.status_code == 201
    assert child.json()["parent_id"] == parent_id


async def test_duplicate_name_same_level_conflicts(client, auth_headers, note_id):
    await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Dup"},
        headers=auth_headers,
    )
    resp = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Dup"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


async def test_list_tree_with_counts(client, auth_headers, note_id):
    folder = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Docs"},
        headers=auth_headers,
    )
    folder_id = folder.json()["id"]
    att = await _upload(client, auth_headers, note_id)
    move = await client.patch(
        f"/api/notes/{note_id}/attachments/{att['id']}",
        json={"folder_id": folder_id},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move.json()["folder_id"] == folder_id

    tree = await client.get(
        f"/api/notes/{note_id}/attachment-folders", headers=auth_headers
    )
    assert tree.status_code == 200
    node = next(f for f in tree.json() if f["id"] == folder_id)
    assert node["attachment_count"] == 1


async def test_move_attachment_to_foreign_folder_404(client, auth_headers, note_id):
    """folder_id from a different note cannot be assigned."""
    other_note = await client.post(
        "/api/notes", json={"title": "Other", "content": ""}, headers=auth_headers
    )
    other_note_id = other_note.json()["id"]
    foreign_folder = await client.post(
        f"/api/notes/{other_note_id}/attachment-folders",
        json={"name": "Foreign"},
        headers=auth_headers,
    )
    foreign_id = foreign_folder.json()["id"]

    att = await _upload(client, auth_headers, note_id)
    resp = await client.patch(
        f"/api/notes/{note_id}/attachments/{att['id']}",
        json={"folder_id": foreign_id},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_rename_folder(client, auth_headers, note_id):
    folder = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "OldName"},
        headers=auth_headers,
    )
    folder_id = folder.json()["id"]
    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/{folder_id}",
        json={"name": "NewName"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


async def test_move_folder_into_descendant_rejected(client, auth_headers, note_id):
    a = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "A"}, headers=auth_headers
    )
    a_id = a.json()["id"]
    b = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "B", "parent_id": a_id},
        headers=auth_headers,
    )
    b_id = b.json()["id"]
    # Try to make A a child of its own descendant B -> circular
    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/{a_id}",
        json={"parent_id": b_id},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_delete_folder_unfiles_attachments_and_reparents_children(
    client, auth_headers, note_id
):
    parent = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Parent"}, headers=auth_headers
    )
    parent_id = parent.json()["id"]
    child = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Child", "parent_id": parent_id},
        headers=auth_headers,
    )
    child_id = child.json()["id"]

    att = await _upload(client, auth_headers, note_id)
    await client.patch(
        f"/api/notes/{note_id}/attachments/{att['id']}",
        json={"folder_id": parent_id},
        headers=auth_headers,
    )

    resp = await client.delete(
        f"/api/notes/{note_id}/attachment-folders/{parent_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    # Child re-parented to root (parent's parent = None)
    tree = await client.get(
        f"/api/notes/{note_id}/attachment-folders", headers=auth_headers
    )
    ids = {f["id"]: f for f in tree.json()}
    assert child_id in ids
    assert ids[child_id]["parent_id"] is None

    # Attachment unfiled
    atts = await client.get(
        f"/api/notes/{note_id}/attachments", headers=auth_headers
    )
    moved = next(a for a in atts.json() if a["id"] == att["id"])
    assert moved["folder_id"] is None


async def test_folders_isolated_per_note(client, auth_headers, note_id):
    other = await client.post(
        "/api/notes", json={"title": "N2", "content": ""}, headers=auth_headers
    )
    other_id = other.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "OnlyHere"}, headers=auth_headers
    )
    resp = await client.get(
        f"/api/notes/{other_id}/attachment-folders", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_folders_require_note_ownership(client, auth_headers, second_auth_headers, note_id):
    resp = await client.get(
        f"/api/notes/{note_id}/attachment-folders", headers=second_auth_headers
    )
    assert resp.status_code == 404


async def test_download_folder_zip_includes_subfolders(client, auth_headers, note_id):
    parent = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Parent"}, headers=auth_headers
    )
    parent_id = parent.json()["id"]
    child = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Child", "parent_id": parent_id},
        headers=auth_headers,
    )
    child_id = child.json()["id"]

    a1 = await _upload(client, auth_headers, note_id, name="top.jpg")
    a2 = await _upload(client, auth_headers, note_id, name="deep.jpg")
    await client.patch(f"/api/notes/{note_id}/attachments/{a1['id']}", json={"folder_id": parent_id}, headers=auth_headers)
    await client.patch(f"/api/notes/{note_id}/attachments/{a2['id']}", json={"folder_id": child_id}, headers=auth_headers)

    resp = await client.get(
        f"/api/notes/{note_id}/attachment-folders/{parent_id}/download", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"

    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    names = set(zf.namelist())
    # Root folder file at top level, subfolder file under "Child/"
    assert "top.jpg" in names
    assert "Child/deep.jpg" in names


async def test_reorder_root_folders(client, auth_headers, note_id):
    names = ["Alpha", "Bravo", "Charlie"]
    ids = []
    for n in names:
        r = await client.post(
            f"/api/notes/{note_id}/attachment-folders", json={"name": n}, headers=auth_headers
        )
        ids.append(r.json()["id"])

    # New folders are alphabetical by creation; reverse the order manually
    reordered = list(reversed(ids))
    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/reorder",
        json=[{"id": fid, "position": idx} for idx, fid in enumerate(reordered)],
        headers=auth_headers,
    )
    assert resp.status_code == 200

    tree = await client.get(
        f"/api/notes/{note_id}/attachment-folders", headers=auth_headers
    )
    assert [f["id"] for f in tree.json()] == reordered


async def test_reorder_can_reparent(client, auth_headers, note_id):
    a = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "A"}, headers=auth_headers
    )
    a_id = a.json()["id"]
    b = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "B"}, headers=auth_headers
    )
    b_id = b.json()["id"]

    # Move B under A via reorder (parent_id change)
    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/reorder",
        json=[{"id": b_id, "position": 0, "parent_id": a_id}],
        headers=auth_headers,
    )
    assert resp.status_code == 200

    tree = await client.get(
        f"/api/notes/{note_id}/attachment-folders", headers=auth_headers
    )
    root = tree.json()
    a_node = next(f for f in root if f["id"] == a_id)
    assert [c["id"] for c in a_node["children"]] == [b_id]


async def test_reorder_rejects_cycle(client, auth_headers, note_id):
    a = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "A"}, headers=auth_headers
    )
    a_id = a.json()["id"]
    b = await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "B", "parent_id": a_id},
        headers=auth_headers,
    )
    b_id = b.json()["id"]
    # Try to reparent A under its descendant B
    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/reorder",
        json=[{"id": a_id, "position": 0, "parent_id": b_id}],
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_move_into_parent_with_duplicate_name_conflicts(client, auth_headers, note_id):
    """Nesting a folder under a parent that already has a same-named child → 409, not 500."""
    parent = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Parent"}, headers=auth_headers
    )
    parent_id = parent.json()["id"]
    # Existing child named "Dup" under Parent
    await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Dup", "parent_id": parent_id},
        headers=auth_headers,
    )
    # A root folder also named "Dup"
    root_dup = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Dup"}, headers=auth_headers
    )
    root_dup_id = root_dup.json()["id"]

    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/{root_dup_id}",
        json={"parent_id": parent_id},
        headers=auth_headers,
    )
    assert resp.status_code == 409


async def test_reorder_into_duplicate_name_conflicts(client, auth_headers, note_id):
    parent = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Parent"}, headers=auth_headers
    )
    parent_id = parent.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/attachment-folders",
        json={"name": "Dup", "parent_id": parent_id},
        headers=auth_headers,
    )
    root_dup = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Dup"}, headers=auth_headers
    )
    root_dup_id = root_dup.json()["id"]

    resp = await client.patch(
        f"/api/notes/{note_id}/attachment-folders/reorder",
        json=[{"id": root_dup_id, "position": 0, "parent_id": parent_id}],
        headers=auth_headers,
    )
    assert resp.status_code == 409


async def test_download_empty_folder_404(client, auth_headers, note_id):
    folder = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Empty"}, headers=auth_headers
    )
    folder_id = folder.json()["id"]
    resp = await client.get(
        f"/api/notes/{note_id}/attachment-folders/{folder_id}/download", headers=auth_headers
    )
    assert resp.status_code == 404
