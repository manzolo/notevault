import pytest


async def _note(client, auth_headers, title="Test Note"):
    r = await client.post("/api/notes", json={"title": title, "content": ""}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()["id"]


async def _event(client, auth_headers, note_id, title="Team Meeting", start="2026-03-15T10:00:00Z"):
    r = await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": title, "start_datetime": start},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()


async def test_list_events_empty(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_create_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    r = await client.post(
        f"/api/notes/{note_id}/events",
        json={
            "title": "Sprint Review",
            "description": "Quarterly review",
            "start_datetime": "2026-03-20T14:00:00Z",
            "end_datetime": "2026-03-20T15:00:00Z",
            "url": "https://meet.example.com/abc",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Sprint Review"
    assert data["description"] == "Quarterly review"
    assert data["note_id"] == note_id
    assert data["url"] == "https://meet.example.com/abc"
    assert data["attachments"] == []


async def test_create_event_missing_note(client, auth_headers):
    r = await client.post(
        "/api/notes/99999/events",
        json={"title": "Ghost Event", "start_datetime": "2026-03-20T14:00:00Z"},
        headers=auth_headers,
    )
    assert r.status_code == 404


async def test_list_events(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id, title="Event A", start="2026-03-10T09:00:00Z")
    await _event(client, auth_headers, note_id, title="Event B", start="2026-03-12T09:00:00Z")
    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    # sorted by start_datetime ascending
    assert data[0]["title"] == "Event A"
    assert data[1]["title"] == "Event B"


async def test_update_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)
    event_id = ev["id"]

    r = await client.put(
        f"/api/notes/{note_id}/events/{event_id}",
        json={"title": "Updated Meeting", "description": "New desc"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Updated Meeting"
    assert data["description"] == "New desc"
    # start_datetime unchanged
    assert data["start_datetime"] is not None


async def test_delete_event(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)
    event_id = ev["id"]

    r = await client.delete(f"/api/notes/{note_id}/events/{event_id}", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    assert r.json() == []


async def test_list_all_events(client, auth_headers):
    note_id = await _note(client, auth_headers, title="My Note")
    await _event(client, auth_headers, note_id, title="Global Event", start="2026-03-15T10:00:00Z")

    r = await client.get("/api/events", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Global Event"
    assert data[0]["note_title"] == "My Note"


async def test_list_all_events_month_filter(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id, title="March Event", start="2026-03-15T10:00:00Z")
    await _event(client, auth_headers, note_id, title="April Event", start="2026-04-01T10:00:00Z")

    r = await client.get("/api/events?month=2026-03", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "March Event"


async def test_list_all_events_month_filter_invalid(client, auth_headers):
    r = await client.get("/api/events?month=bad-input", headers=auth_headers)
    assert r.status_code == 400


async def test_events_ownership(client, auth_headers, second_auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id)
    event_id = ev["id"]

    # Second user cannot access events on first user's note
    r = await client.get(f"/api/notes/{note_id}/events", headers=second_auth_headers)
    assert r.status_code == 404

    # Second user's global events list is empty
    r = await client.get("/api/events", headers=second_auth_headers)
    assert r.status_code == 200
    assert r.json() == []

    # Second user cannot delete first user's event
    r = await client.delete(f"/api/notes/{note_id}/events/{event_id}", headers=second_auth_headers)
    assert r.status_code == 404


async def test_events_cascade_delete_with_note(client, auth_headers):
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id)

    await client.delete(f"/api/notes/{note_id}", headers=auth_headers)

    # Note gone, so events endpoint returns 404
    r = await client.get(f"/api/notes/{note_id}/events", headers=auth_headers)
    assert r.status_code == 404

    # Global list is empty
    r = await client.get("/api/events", headers=auth_headers)
    assert r.json() == []
