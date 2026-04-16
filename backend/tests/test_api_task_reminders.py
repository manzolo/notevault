import pytest


async def _note(client, auth_headers, title="Test Note"):
    r = await client.post("/api/notes", json={"title": title, "content": ""}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()["id"]


async def _task(client, auth_headers, note_id, title="My Task", due_date="2030-01-01T10:00:00Z"):
    r = await client.post(
        f"/api/notes/{note_id}/tasks",
        json={"title": title, "due_date": due_date},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


async def _reminder(client, auth_headers, task_id, minutes=60, **kwargs):
    payload = {"minutes_before": minutes, "notify_in_app": True, **kwargs}
    r = await client.post(f"/api/tasks/{task_id}/reminders", json=payload, headers=auth_headers)
    return r


async def test_create_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    r = await _reminder(client, auth_headers, task_id)
    assert r.status_code == 201
    data = r.json()
    assert data["task_id"] == task_id
    assert data["minutes_before"] == 60
    assert data["notify_in_app"] is True
    assert data["notified_at"] is None


async def test_list_reminders(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    await _reminder(client, auth_headers, task_id, minutes=30)
    await _reminder(client, auth_headers, task_id, minutes=120)
    r = await client.get(f"/api/tasks/{task_id}/reminders", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["minutes_before"] == 30
    assert data[1]["minutes_before"] == 120


async def test_update_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    rid = (await _reminder(client, auth_headers, task_id)).json()["id"]
    r = await client.put(
        f"/api/tasks/{task_id}/reminders/{rid}",
        json={"notify_telegram": True},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["notify_telegram"] is True


async def test_update_minutes_resets_notified_at(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    rid = (await _reminder(client, auth_headers, task_id)).json()["id"]
    r = await client.put(
        f"/api/tasks/{task_id}/reminders/{rid}",
        json={"minutes_before": 30},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["notified_at"] is None


async def test_delete_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    rid = (await _reminder(client, auth_headers, task_id)).json()["id"]
    r = await client.delete(f"/api/tasks/{task_id}/reminders/{rid}", headers=auth_headers)
    assert r.status_code == 204
    r = await client.get(f"/api/tasks/{task_id}/reminders", headers=auth_headers)
    assert r.json() == []


async def test_max_reminders_per_task(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    for m in [10, 30, 60, 120, 1440]:
        r = await _reminder(client, auth_headers, task_id, minutes=m)
        assert r.status_code == 201
    r = await _reminder(client, auth_headers, task_id, minutes=10080)
    assert r.status_code == 400


async def test_invalid_minutes_before(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    r = await _reminder(client, auth_headers, task_id, minutes=0)
    assert r.status_code == 422


async def test_user_isolation(client, auth_headers, second_auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    r = await client.get(f"/api/tasks/{task_id}/reminders", headers=second_auth_headers)
    assert r.status_code == 404
    r = await _reminder(client, second_auth_headers, task_id)
    assert r.status_code == 404


async def test_cascade_on_task_delete(client, auth_headers):
    note_id = await _note(client, auth_headers)
    task_id = await _task(client, auth_headers, note_id)
    await _reminder(client, auth_headers, task_id)
    await client.delete(f"/api/notes/{note_id}/tasks/{task_id}", headers=auth_headers)
    # task is gone → reminders list returns 404
    r = await client.get(f"/api/tasks/{task_id}/reminders", headers=auth_headers)
    assert r.status_code == 404


async def test_reminder_no_due_date(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.post(f"/api/notes/{note_id}/tasks", json={"title": "No date"}, headers=auth_headers)
    task_id = r.json()["id"]
    # API accepts reminder even without due_date (scheduler just skips it)
    r = await _reminder(client, auth_headers, task_id)
    assert r.status_code == 201
