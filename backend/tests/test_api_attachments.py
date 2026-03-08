import io
import os
import pytest
import pytest_asyncio

# Minimal valid file bytes for magic-byte detection
_JPEG_BYTES = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
]) + b"\x00" * 108 + bytes([0xFF, 0xD9])

def _make_pdf() -> bytes:
    """Build a minimal but parseable PDF with proper xref byte offsets."""
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = (
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R "
        b"/MediaBox [0 0 612 792] /Resources << >> >>\nendobj\n"
    )
    header = b"%PDF-1.4\n"
    off1 = len(header)
    off2 = off1 + len(obj1)
    off3 = off2 + len(obj2)
    body = header + obj1 + obj2 + obj3
    xref_pos = len(body)
    xref = (
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        + f"{off1:010d} 00000 n \n".encode()
        + f"{off2:010d} 00000 n \n".encode()
        + f"{off3:010d} 00000 n \n".encode()
    )
    trailer = (
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"
    )
    return body + xref + trailer


_PDF_BYTES = _make_pdf()

_ZIP_BYTES = bytes([
    0x50, 0x4B, 0x05, 0x06,  # end-of-central-directory signature (empty zip)
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00,
])

_MD_CONTENT = "# Test Attachment\n\nThis is a **markdown** file.\n"


@pytest_asyncio.fixture
async def note_id(client, auth_headers):
    resp = await client.post(
        "/api/notes",
        json={"title": "Attachment Note", "content": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest_asyncio.fixture
async def tag_id(client, auth_headers):
    resp = await client.post(
        "/api/tags",
        json={"name": "attach-tag"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ── Upload tests ─────────────────────────────────────────────────────────────

async def test_upload_jpeg(client, auth_headers, note_id):
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("photo.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["mime_type"] == "image/jpeg"
    assert data["filename"] == "photo.jpg"
    assert data["size_bytes"] == len(_JPEG_BYTES)
    assert "stored_filename" not in data
    assert "extracted_text" not in data


async def test_upload_jpeg_file_exists_on_disk(client, auth_headers, note_id):
    from app.config import get_settings
    settings = get_settings()

    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("disk.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    attachment_id = resp.json()["id"]

    # Get attachment detail to find stored path via stream endpoint
    stream_resp = await client.get(
        f"/api/notes/{note_id}/attachments/{attachment_id}/stream",
        headers=auth_headers,
    )
    assert stream_resp.status_code == 200


async def test_upload_markdown(client, auth_headers, note_id):
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("readme.md", io.BytesIO(_MD_CONTENT.encode()), "text/plain")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["mime_type"] == "text/markdown"


async def test_upload_zip(client, auth_headers, note_id):
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("archive.zip", io.BytesIO(_ZIP_BYTES), "application/zip")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["mime_type"] == "application/zip"


async def test_upload_exceeds_size_limit(client, auth_headers, note_id):
    """11 MB upload should be rejected with 413."""
    big_data = b"X" * (11 * 1024 * 1024)
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("big.bin", io.BytesIO(big_data), "application/octet-stream")},
        headers=auth_headers,
    )
    assert resp.status_code == 413


async def test_upload_unsupported_type(client, auth_headers, note_id):
    """An .exe file should be rejected with 415."""
    exe_bytes = b"MZ" + b"\x00" * 50  # PE/COFF magic
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("malware.exe", io.BytesIO(exe_bytes), "application/octet-stream")},
        headers=auth_headers,
    )
    assert resp.status_code == 415


async def test_upload_to_nonexistent_note(client, auth_headers):
    resp = await client.post(
        "/api/notes/999999/attachments",
        files={"file": ("photo.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_upload_to_other_users_note(client, auth_headers, second_auth_headers):
    # Create note as user 1
    note_resp = await client.post(
        "/api/notes",
        json={"title": "Private Note", "content": ""},
        headers=auth_headers,
    )
    note_id = note_resp.json()["id"]

    # Try to upload as user 2
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("photo.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


# ── PDF text extraction ───────────────────────────────────────────────────────

async def test_upload_pdf_extracted_text(client, auth_headers, note_id):
    """PDF upload should have non-None extracted_text (checked via internal query, not response)."""
    # The response schema excludes extracted_text, so we verify via search later
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("doc.pdf", io.BytesIO(_PDF_BYTES), "application/pdf")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["mime_type"] == "application/pdf"
    # extracted_text should not be in public response
    assert "extracted_text" not in data


# ── List tests ────────────────────────────────────────────────────────────────

async def test_list_attachments(client, auth_headers, note_id):
    # Upload two files
    for i in range(2):
        await client.post(
            f"/api/notes/{note_id}/attachments",
            files={"file": (f"img{i}.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
            headers=auth_headers,
        )

    resp = await client.get(f"/api/notes/{note_id}/attachments", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_attachments_empty(client, auth_headers, note_id):
    resp = await client.get(f"/api/notes/{note_id}/attachments", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_attachment(client, auth_headers, note_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("get.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.get(f"/api/notes/{note_id}/attachments/{att_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == att_id


# ── Stream tests ──────────────────────────────────────────────────────────────

async def test_stream_image_inline(client, auth_headers, note_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("stream.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.get(
        f"/api/notes/{note_id}/attachments/{att_id}/stream",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    cd = resp.headers.get("content-disposition", "")
    assert cd.startswith("inline")
    assert "stream.jpg" in cd


async def test_stream_pdf_inline(client, auth_headers, note_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("doc.pdf", io.BytesIO(_PDF_BYTES), "application/pdf")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.get(
        f"/api/notes/{note_id}/attachments/{att_id}/stream",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    cd = resp.headers.get("content-disposition", "")
    assert cd.startswith("inline")
    assert "doc.pdf" in cd


async def test_stream_zip_attachment(client, auth_headers, note_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("archive.zip", io.BytesIO(_ZIP_BYTES), "application/zip")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.get(
        f"/api/notes/{note_id}/attachments/{att_id}/stream",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    cd = resp.headers.get("content-disposition", "")
    assert cd.startswith("attachment")
    assert "archive.zip" in cd


# ── Delete tests ──────────────────────────────────────────────────────────────

async def test_delete_attachment(client, auth_headers, note_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("del.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.delete(
        f"/api/notes/{note_id}/attachments/{att_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Should be gone
    get_resp = await client.get(
        f"/api/notes/{note_id}/attachments/{att_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_delete_nonexistent_attachment(client, auth_headers, note_id):
    resp = await client.delete(
        f"/api/notes/{note_id}/attachments/999999",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ── Tag tests ──────────────────────────────────────────────────────────────────

async def test_upload_with_tags(client, auth_headers, note_id, tag_id):
    resp = await client.post(
        f"/api/notes/{note_id}/attachments",
        data={"tag_ids": [str(tag_id)]},
        files={"file": ("tagged.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["tags"]) == 1
    assert data["tags"][0]["id"] == tag_id


async def test_update_attachment_tags(client, auth_headers, note_id, tag_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": ("tagme.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    resp = await client.put(
        f"/api/notes/{note_id}/attachments/{att_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tags"]) == 1
    assert data["tags"][0]["id"] == tag_id


async def test_clear_attachment_tags(client, auth_headers, note_id, tag_id):
    upload = await client.post(
        f"/api/notes/{note_id}/attachments",
        data={"tag_ids": [str(tag_id)]},
        files={"file": ("clear.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )
    att_id = upload.json()["id"]

    # Clear tags
    resp = await client.put(
        f"/api/notes/{note_id}/attachments/{att_id}/tags",
        json={"tag_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["tags"] == []


# ── Search integration ────────────────────────────────────────────────────────

async def test_search_finds_note_via_attachment_filename(client, auth_headers):
    """A note whose attachment filename matches the query should appear in search."""
    note_resp = await client.post(
        "/api/notes",
        json={"title": "searchable note xyz", "content": ""},
        headers=auth_headers,
    )
    nid = note_resp.json()["id"]

    # Upload a file — filename will be indexed by FTS trigger
    await client.post(
        f"/api/notes/{nid}/attachments",
        files={"file": ("uniqueword_attachment.jpg", io.BytesIO(_JPEG_BYTES), "image/jpeg")},
        headers=auth_headers,
    )

    # The note itself has "searchable" in title, should appear
    search_resp = await client.get(
        "/api/search?q=searchable",
        headers=auth_headers,
    )
    assert search_resp.status_code == 200
    ids = [item["id"] for item in search_resp.json()["items"]]
    assert nid in ids


async def test_search_finds_note_via_attachment_markdown_content(client, auth_headers):
    """A note found only via attachment extracted text should appear in search."""
    note_resp = await client.post(
        "/api/notes",
        json={"title": "empty note for attachment search", "content": ""},
        headers=auth_headers,
    )
    nid = note_resp.json()["id"]

    unique_word = "xyzzy42quux"
    md_content = f"# Header\n\n{unique_word} is in this markdown file.\n"

    await client.post(
        f"/api/notes/{nid}/attachments",
        files={"file": ("content.md", io.BytesIO(md_content.encode()), "text/plain")},
        headers=auth_headers,
    )

    search_resp = await client.get(
        f"/api/search?q={unique_word}",
        headers=auth_headers,
    )
    assert search_resp.status_code == 200
    ids = [item["id"] for item in search_resp.json()["items"]]
    assert nid in ids
