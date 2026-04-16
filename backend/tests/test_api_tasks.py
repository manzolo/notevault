import pytest


async def _note(client, auth_headers, title="Test Note"):
    r = await client.post("/api/notes", json={"title": title, "content": ""}, headers=auth_headers)
    return r.json()["id"]


async def test_create_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Buy milk"}, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Buy milk"
    assert data["is_done"] is False
    assert data["note_id"] == note_id


async def test_list_tasks(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Task A"}, headers=auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Task B"}, headers=auth_headers)
    r = await client.get(f"/api/notes/{note_id}/tasks", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_toggle_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = (await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Do it"}, headers=auth_headers)).json()["id"]

    r = await client.put(f"/api/notes/{note_id}/tasks/{task_id}", json={"is_done": True}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_done"] is True


async def test_delete_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = (await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Remove me"}, headers=auth_headers)).json()["id"]

    r = await client.delete(f"/api/notes/{note_id}/tasks/{task_id}", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get(f"/api/notes/{note_id}/tasks", headers=auth_headers)
    assert len(r.json()) == 0


async def test_tasks_ownership(client, auth_headers, second_auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = (await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Mine"}, headers=auth_headers)).json()["id"]

    # Other user cannot access
    r = await client.get(f"/api/notes/{note_id}/tasks", headers=second_auth_headers)
    assert r.status_code == 404

    r = await client.put(f"/api/notes/{note_id}/tasks/{task_id}", json={"is_done": True}, headers=second_auth_headers)
    assert r.status_code == 404


async def test_get_all_tasks(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Todo"}, headers=auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Done", "is_done": True}, headers=auth_headers)

    r = await client.get("/api/tasks", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2
    assert all("note_title" in t for t in r.json())


async def test_get_all_tasks_filter_todo(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Todo"}, headers=auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Done", "is_done": True}, headers=auth_headers)

    r = await client.get("/api/tasks?status=todo", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "Todo"


async def test_tasks_cascade_delete_with_note(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await client.post(f"/api/notes/{note_id}/tasks", json={"title": "Will be gone"}, headers=auth_headers)

    await client.delete(f"/api/notes/{note_id}", headers=auth_headers)

    # Note is gone, so task endpoint returns 404
    r = await client.get(f"/api/notes/{note_id}/tasks", headers=auth_headers)
    assert r.status_code == 404


async def test_update_due_date_resets_reminder_notified_at(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = (
        await client.post(
            f"/api/notes/{note_id}/tasks",
            json={"title": "Remind me", "due_date": "2030-01-01T10:00:00Z"},
            headers=auth_headers,
        )
    ).json()["id"]

    # Add a reminder
    r = await client.post(
        f"/api/tasks/{task_id}/reminders",
        json={"minutes_before": 60, "notify_in_app": True},
        headers=auth_headers,
    )
    assert r.status_code == 201

    # Change due_date → notified_at should be reset
    r = await client.put(
        f"/api/notes/{note_id}/tasks/{task_id}",
        json={"due_date": "2030-06-01T10:00:00Z"},
        headers=auth_headers,
    )
    assert r.status_code == 200

    r = await client.get(f"/api/tasks/{task_id}/reminders", headers=auth_headers)
    assert r.status_code == 200
    for reminder in r.json():
        assert reminder["notified_at"] is None
