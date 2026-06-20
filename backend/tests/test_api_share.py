import io

import pytest

_JPEG_BYTES = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
]) + b"\x00" * 108 + bytes([0xFF, 0xD9])


async def _note(client, auth_headers, title="Shared Note"):
    r = await client.post("/api/notes", json={"title": title, "content": "Hello **world**"}, headers=auth_headers)
    return r.json()["id"]


async def test_shared_note_includes_attachment_folders(client, auth_headers):
    note_id = await _note(client, auth_headers)

    # Create a folder and an attachment, then move the attachment into the folder
    folder = await client.post(
        f"/api/notes/{note_id}/attachment-folders", json={"name": "Docs"}, headers=auth_headers
    )
    folder_id = folder.json()["id"]
    up = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("img.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = up.json()["id"]
    await client.patch(
        f"/api/notes/{note_id}/attachments/{att_id}",
        json={"folder_id": folder_id},
        headers=auth_headers,
    )

    token = (await client.post(
        f"/api/notes/{note_id}/share",
        json={"sections": {"attachments": True}},
        headers=auth_headers,
    )).json()["token"]

    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 200
    data = r.json()
    # Folder tree is present with the right count
    folders = data["attachment_folders"]
    assert len(folders) == 1
    assert folders[0]["id"] == folder_id
    assert folders[0]["attachment_count"] == 1
    # Attachment carries its folder_id
    att = next(a for a in data["attachments"] if a["id"] == att_id)
    assert att["folder_id"] == folder_id


async def test_create_share_token(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert "token" in data
    assert len(data["token"]) > 10


async def test_create_share_token_idempotent(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r1 = await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)
    r2 = await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r1.json()["token"] == r2.json()["token"]


async def test_get_share_status(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.get(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["token"] is None

    await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)
    r = await client.get(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.json()["token"] is not None


async def test_delete_share_token(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)
    r = await client.delete(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get(f"/api/notes/{note_id}/share", headers=auth_headers)
    assert r.json()["token"] is None


async def test_access_shared_note_public(client, auth_headers):
    note_id = await _note(client, auth_headers)
    token = (await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)).json()["token"]

    # Access without auth
    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Shared Note"
    assert data["content"] == "Hello **world**"


async def test_invalid_share_token(client):
    r = await client.get("/api/share/nonexistent_token_xyz")
    assert r.status_code == 404


async def test_share_ownership(client, auth_headers, second_auth_headers):
    note_id = await _note(client, auth_headers)
    # User2 cannot share user1's note
    r = await client.post(f"/api/notes/{note_id}/share", headers=second_auth_headers)
    assert r.status_code == 404


async def test_share_deleted_on_note_delete(client, auth_headers):
    note_id = await _note(client, auth_headers)
    token = (await client.post(f"/api/notes/{note_id}/share", headers=auth_headers)).json()["token"]

    await client.delete(f"/api/notes/{note_id}", headers=auth_headers)
    r = await client.get(f"/api/share/{token}")
    assert r.status_code == 404
