import pytest


async def _note(client, auth_headers):
    r = await client.post("/api/notes", json={"title": "Note", "content": ""}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()["id"]


async def _event(client, auth_headers, note_id):
    r = await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Meeting", "start_datetime": "2027-06-15T10:00:00Z"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


async def _reminder(client, auth_headers, event_id, minutes_before=60):
    r = await client.post(
        f"/api/events/{event_id}/reminders",
        json={"minutes_before": minutes_before, "notify_in_app": True, "notify_telegram": False, "notify_email": False},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()


async def test_create_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    r = await client.post(
        f"/api/events/{event_id}/reminders",
        json={"minutes_before": 30, "notify_in_app": True, "notify_telegram": True, "notify_email": False},
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["minutes_before"] == 30
    assert data["notify_in_app"] is True
    assert data["notify_telegram"] is True
    assert data["notify_email"] is False
    assert data["event_id"] == event_id


async def test_list_reminders_empty(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    r = await client.get(f"/api/events/{event_id}/reminders", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_list_reminders(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    await _reminder(client, auth_headers, event_id, 10)
    await _reminder(client, auth_headers, event_id, 1440)
    r = await client.get(f"/api/events/{event_id}/reminders", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["minutes_before"] == 10
    assert data[1]["minutes_before"] == 1440


async def test_update_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    reminder = await _reminder(client, auth_headers, event_id, 60)
    rid = reminder["id"]

    r = await client.put(
        f"/api/events/{event_id}/reminders/{rid}",
        json={"minutes_before": 120, "notify_email": True},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["minutes_before"] == 120
    assert data["notify_email"] is True
    assert data["notify_in_app"] is True  # unchanged


async def test_delete_reminder(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    reminder = await _reminder(client, auth_headers, event_id)
    rid = reminder["id"]

    r = await client.delete(f"/api/events/{event_id}/reminders/{rid}", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get(f"/api/events/{event_id}/reminders", headers=auth_headers)
    assert r.json() == []


async def test_max_reminders_per_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    for minutes in [10, 30, 60, 120, 1440]:
        await _reminder(client, auth_headers, event_id, minutes)

    r = await client.post(
        f"/api/events/{event_id}/reminders",
        json={"minutes_before": 10080, "notify_in_app": True},
        headers=auth_headers,
    )
    assert r.status_code == 400


async def test_reminder_isolation(client, auth_headers, second_auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    await _reminder(client, auth_headers, event_id)

    # Other user cannot access event → 404
    r = await client.get(f"/api/events/{event_id}/reminders", headers=second_auth_headers)
    assert r.status_code == 404  # event not found for user2


async def test_reminder_invalid_minutes(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    r = await client.post(
        f"/api/events/{event_id}/reminders",
        json={"minutes_before": 0, "notify_in_app": True},
        headers=auth_headers,
    )
    assert r.status_code == 422


async def test_reminder_not_found(client, auth_headers):
    note_id = await _note(client, auth_headers)
    event_id = await _event(client, auth_headers, note_id)
    r = await client.delete(f"/api/events/{event_id}/reminders/99999", headers=auth_headers)
    assert r.status_code == 404
