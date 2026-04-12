"""
Tests for archive/restore functionality across all entities:
Tasks, Secrets, Bookmarks, Events, Attachments.

Also tests:
- task due_date accepts 'YYYY-MM-DD' date-only strings (not just full datetimes)
- list_notes date filter matches notes via task due_date (mini-calendar fix)
"""
import io
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _note(client, auth_headers, title="Test Note"):
    r = await client.post("/api/notes", json={"title": title, "content": ""}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()["id"]


async def _task(client, auth_headers, note_id, title="My Task", **kwargs):
    r = await client.post(f"/api/notes/{note_id}/tasks", json={"title": title, **kwargs}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()


async def _secret(client, auth_headers, note_id, name="API Key"):
    r = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": name, "secret_type": "api_key", "value": "s3cr3t",
    }, headers=auth_headers)
    assert r.status_code == 201
    return r.json()


async def _bookmark(client, auth_headers, note_id, url="https://example.com"):
    r = await client.post(f"/api/notes/{note_id}/bookmarks", json={"url": url, "title": "Example"}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()


async def _event(client, auth_headers, note_id, title="Meeting", start="2026-06-01T10:00:00Z"):
    r = await client.post(f"/api/notes/{note_id}/events", json={
        "title": title, "start_datetime": start,
    }, headers=auth_headers)
    assert r.status_code == 201
    return r.json()


async def _attachment(client, auth_headers, note_id, filename="test.txt"):
    r = await client.post(
        f"/api/notes/{note_id}/attachments",
        files={"file": (filename, io.BytesIO(b"hello world"), "text/plain")},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()


# ===========================================================================
# Task due_date: accepts 'YYYY-MM-DD' date-only strings
# ===========================================================================

async def test_task_due_date_date_only_string_create(client, auth_headers):
    """POST /tasks with due_date='YYYY-MM-DD' must succeed (not 422)."""
    note_id = await _note(client, auth_headers)
    r = await client.post(f"/api/notes/{note_id}/tasks", json={
        "title": "Deadline task",
        "due_date": "2026-07-15",
    }, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Deadline task"
    # Response contains a datetime string starting with the date
    assert data["due_date"].startswith("2026-07-15")


async def test_task_due_date_date_only_string_update(client, auth_headers):
    """PUT /tasks/{id} with due_date='YYYY-MM-DD' must succeed (not 422)."""
    note_id = await _note(client, auth_headers)
    task = await _task(client, auth_headers, note_id)

    r = await client.put(f"/api/notes/{note_id}/tasks/{task['id']}", json={
        "due_date": "2026-08-20",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["due_date"].startswith("2026-08-20")


async def test_task_due_date_clear(client, auth_headers):
    """Setting due_date=null clears the date."""
    note_id = await _note(client, auth_headers)
    task = await _task(client, auth_headers, note_id, due_date="2026-07-15")

    r = await client.put(f"/api/notes/{note_id}/tasks/{task['id']}", json={"due_date": None}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["due_date"] is None


async def test_task_due_date_full_datetime_still_accepted(client, auth_headers):
    """Full ISO datetime strings still accepted."""
    note_id = await _note(client, auth_headers)
    r = await client.post(f"/api/notes/{note_id}/tasks", json={
        "title": "Full DT",
        "due_date": "2026-09-01T08:00:00Z",
    }, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["due_date"] is not None


# ===========================================================================
# Notes date filter includes tasks with matching due_date (mini-calendar fix)
# ===========================================================================

async def test_list_notes_date_filter_matches_task_due_date(client, auth_headers):
    """A note created long before a date filter should still appear
    if it has a task with due_date within the filter range."""
    note_id = await _note(client, auth_headers, title="Note with due task")
    await _task(client, auth_headers, note_id, title="Important", due_date="2026-07-10")

    # Filter by that exact day — note creation date doesn't matter
    r = await client.get(
        "/api/notes",
        params={"created_after": "2026-07-10T00:00:00", "created_before": "2026-07-10T23:59:59"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    ids = [n["id"] for n in data["items"]]
    assert note_id in ids


async def test_list_notes_date_filter_excludes_task_outside_range(client, auth_headers):
    """A note with a task due on a different day must NOT appear."""
    note_id = await _note(client, auth_headers, title="Wrong day note")
    await _task(client, auth_headers, note_id, title="Later task", due_date="2026-09-01")

    r = await client.get(
        "/api/notes",
        params={"created_after": "2026-07-10T00:00:00", "created_before": "2026-07-10T23:59:59"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    ids = [n["id"] for n in r.json()["items"]]
    assert note_id not in ids


# ===========================================================================
# Task archive / restore
# ===========================================================================

async def test_task_default_not_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task = await _task(client, auth_headers, note_id)
    assert task["is_archived"] is False
    assert task["archive_note"] is None


async def test_archive_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task = await _task(client, auth_headers, note_id)

    r = await client.put(f"/api/notes/{note_id}/tasks/{task['id']}", json={
        "is_archived": True, "archive_note": "no longer needed",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_archived"] is True
    assert data["archive_note"] == "no longer needed"


async def test_list_tasks_excludes_archived_by_default(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _task(client, auth_headers, note_id, title="Active")
    archived = await _task(client, auth_headers, note_id, title="Archived")
    await client.put(f"/api/notes/{note_id}/tasks/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/tasks", headers=auth_headers)
    ids = [t["id"] for t in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


async def test_list_tasks_archived_only(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _task(client, auth_headers, note_id, title="Active")
    archived = await _task(client, auth_headers, note_id, title="Archived")
    await client.put(f"/api/notes/{note_id}/tasks/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/tasks", params={"archived_only": "true"}, headers=auth_headers)
    ids = [t["id"] for t in r.json()]
    assert archived["id"] in ids
    assert len(ids) == 1


async def test_restore_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task = await _task(client, auth_headers, note_id)
    await client.put(f"/api/notes/{note_id}/tasks/{task['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.put(f"/api/notes/{note_id}/tasks/{task['id']}", json={
        "is_archived": False, "archive_note": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is False

    # Must appear in normal list again
    r = await client.get(f"/api/notes/{note_id}/tasks", headers=auth_headers)
    assert task["id"] in [t["id"] for t in r.json()]


async def test_global_tasks_excludes_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _task(client, auth_headers, note_id, title="Active")
    archived = await _task(client, auth_headers, note_id, title="Archived")
    await client.put(f"/api/notes/{note_id}/tasks/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get("/api/tasks", headers=auth_headers)
    ids = [t["id"] for t in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


# ===========================================================================
# Secret archive / restore
# ===========================================================================

async def test_secret_default_not_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    secret = await _secret(client, auth_headers, note_id)
    assert secret["is_archived"] is False


async def test_archive_secret(client, auth_headers):
    note_id = await _note(client, auth_headers)
    secret = await _secret(client, auth_headers, note_id)

    r = await client.patch(f"/api/notes/{note_id}/secrets/{secret['id']}/archive", json={
        "is_archived": True, "archive_note": "rotated",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_archived"] is True
    assert data["archive_note"] == "rotated"


async def test_list_secrets_excludes_archived_by_default(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _secret(client, auth_headers, note_id, name="Active Key")
    archived = await _secret(client, auth_headers, note_id, name="Old Key")
    await client.patch(f"/api/notes/{note_id}/secrets/{archived['id']}/archive", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/secrets", headers=auth_headers)
    ids = [s["id"] for s in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


async def test_list_secrets_archived_only(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _secret(client, auth_headers, note_id, name="Active Key")
    archived = await _secret(client, auth_headers, note_id, name="Old Key")
    await client.patch(f"/api/notes/{note_id}/secrets/{archived['id']}/archive", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/secrets", params={"archived_only": "true"}, headers=auth_headers)
    ids = [s["id"] for s in r.json()]
    assert archived["id"] in ids
    assert len(ids) == 1


async def test_restore_secret(client, auth_headers):
    note_id = await _note(client, auth_headers)
    secret = await _secret(client, auth_headers, note_id)
    await client.patch(f"/api/notes/{note_id}/secrets/{secret['id']}/archive", json={"is_archived": True}, headers=auth_headers)

    r = await client.patch(f"/api/notes/{note_id}/secrets/{secret['id']}/archive", json={
        "is_archived": False, "archive_note": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is False

    r = await client.get(f"/api/notes/{note_id}/secrets", headers=auth_headers)
    assert secret["id"] in [s["id"] for s in r.json()]


# ===========================================================================
# Bookmark archive / restore
# ===========================================================================

async def test_bookmark_default_not_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    bm = await _bookmark(client, auth_headers, note_id)
    assert bm["is_archived"] is False


async def test_archive_bookmark(client, auth_headers):
    note_id = await _note(client, auth_headers)
    bm = await _bookmark(client, auth_headers, note_id)

    r = await client.put(f"/api/notes/{note_id}/bookmarks/{bm['id']}", json={
        "url": bm["url"], "is_archived": True, "archive_note": "dead link",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_archived"] is True
    assert data["archive_note"] == "dead link"


async def test_list_bookmarks_excludes_archived_by_default(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _bookmark(client, auth_headers, note_id, url="https://active.com")
    archived = await _bookmark(client, auth_headers, note_id, url="https://old.com")
    await client.put(f"/api/notes/{note_id}/bookmarks/{archived['id']}", json={
        "url": archived["url"], "is_archived": True,
    }, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/bookmarks", headers=auth_headers)
    ids = [b["id"] for b in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


async def test_list_bookmarks_archived_only(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _bookmark(client, auth_headers, note_id, url="https://active.com")
    archived = await _bookmark(client, auth_headers, note_id, url="https://old.com")
    await client.put(f"/api/notes/{note_id}/bookmarks/{archived['id']}", json={
        "url": archived["url"], "is_archived": True,
    }, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/bookmarks", params={"archived_only": "true"}, headers=auth_headers)
    ids = [b["id"] for b in r.json()]
    assert archived["id"] in ids
    assert len(ids) == 1


async def test_restore_bookmark(client, auth_headers):
    note_id = await _note(client, auth_headers)
    bm = await _bookmark(client, auth_headers, note_id)
    await client.put(f"/api/notes/{note_id}/bookmarks/{bm['id']}", json={
        "url": bm["url"], "is_archived": True,
    }, headers=auth_headers)

    r = await client.put(f"/api/notes/{note_id}/bookmarks/{bm['id']}", json={
        "url": bm["url"], "is_archived": False, "archive_note": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is False

    r = await client.get(f"/api/notes/{note_id}/bookmarks", headers=auth_headers)
    assert bm["id"] in [b["id"] for b in r.json()]


# ===========================================================================
# Event archive / restore
# ===========================================================================

async def test_event_default_not_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)
    assert ev["is_archived"] is False


async def test_archive_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)

    r = await client.put(f"/api/notes/{note_id}/events/{ev['id']}", json={
        "is_archived": True, "archive_note": "cancelled",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_archived"] is True
    assert data["archive_note"] == "cancelled"


async def test_list_events_excludes_archived_by_default(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _event(client, auth_headers, note_id, title="Active Meeting")
    archived = await _event(client, auth_headers, note_id, title="Cancelled Meeting", start="2026-06-02T10:00:00Z")
    await client.put(f"/api/notes/{note_id}/events/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    ids = [e["id"] for e in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


async def test_list_events_archived_only(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id, title="Active")
    archived = await _event(client, auth_headers, note_id, title="Cancelled", start="2026-06-02T10:00:00Z")
    await client.put(f"/api/notes/{note_id}/events/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/events", params={"archived_only": "true"}, headers=auth_headers)
    ids = [e["id"] for e in r.json()]
    assert archived["id"] in ids
    assert len(ids) == 1


async def test_restore_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)
    await client.put(f"/api/notes/{note_id}/events/{ev['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.put(f"/api/notes/{note_id}/events/{ev['id']}", json={
        "is_archived": False, "archive_note": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is False

    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    assert ev["id"] in [e["id"] for e in r.json()]


async def test_global_events_excludes_archived(client, auth_headers):
    """GET /api/events (mini-calendar feed) must not return archived events."""
    note_id = await _note(client, auth_headers)
    active = await _event(client, auth_headers, note_id, title="Active", start="2026-06-15T10:00:00Z")
    archived = await _event(client, auth_headers, note_id, title="Archived", start="2026-06-15T11:00:00Z")
    await client.put(f"/api/notes/{note_id}/events/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get("/api/events", params={"month": "2026-06"}, headers=auth_headers)
    assert r.status_code == 200
    ids = [e["id"] for e in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


# ===========================================================================
# Attachment archive / restore
# ===========================================================================

async def test_attachment_default_not_archived(client, auth_headers):
    note_id = await _note(client, auth_headers)
    att = await _attachment(client, auth_headers, note_id)
    assert att["is_archived"] is False


async def test_archive_attachment(client, auth_headers):
    note_id = await _note(client, auth_headers)
    att = await _attachment(client, auth_headers, note_id)

    r = await client.patch(f"/api/notes/{note_id}/attachments/{att['id']}", json={
        "is_archived": True, "archive_note": "old version",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_archived"] is True
    assert data["archive_note"] == "old version"


async def test_list_attachments_excludes_archived_by_default(client, auth_headers):
    note_id = await _note(client, auth_headers)
    active = await _attachment(client, auth_headers, note_id, filename="active.txt")
    archived = await _attachment(client, auth_headers, note_id, filename="old.txt")
    await client.patch(f"/api/notes/{note_id}/attachments/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/attachments", headers=auth_headers)
    ids = [a["id"] for a in r.json()]
    assert active["id"] in ids
    assert archived["id"] not in ids


async def test_list_attachments_archived_only(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _attachment(client, auth_headers, note_id, filename="active.txt")
    archived = await _attachment(client, auth_headers, note_id, filename="old.txt")
    await client.patch(f"/api/notes/{note_id}/attachments/{archived['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.get(f"/api/notes/{note_id}/attachments", params={"archived_only": "true"}, headers=auth_headers)
    ids = [a["id"] for a in r.json()]
    assert archived["id"] in ids
    assert len(ids) == 1


async def test_restore_attachment(client, auth_headers):
    note_id = await _note(client, auth_headers)
    att = await _attachment(client, auth_headers, note_id)
    await client.patch(f"/api/notes/{note_id}/attachments/{att['id']}", json={"is_archived": True}, headers=auth_headers)

    r = await client.patch(f"/api/notes/{note_id}/attachments/{att['id']}", json={
        "is_archived": False, "archive_note": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is False

    r = await client.get(f"/api/notes/{note_id}/attachments", headers=auth_headers)
    assert att["id"] in [a["id"] for a in r.json()]
