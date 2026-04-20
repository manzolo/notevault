from datetime import date

import pytest
from app.models.database import NoteField


async def _note(client, auth_headers, title="Test Note"):
    r = await client.post("/api/notes", json={"title": title, "content": ""}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()["id"]


async def _event(client, auth_headers, note_id, title="Team Meeting", start="2026-03-15T10:00:00Z", **kwargs):
    payload = {"title": title, "start_datetime": start, **kwargs}
    r = await client.post(
        f"/api/notes/{note_id}/events",
        json=payload,
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()


async def _task(client, auth_headers, note_id, title="Follow up", due_date="2099-06-16T10:00:00Z", **kwargs):
    payload = {"title": title, "due_date": due_date, **kwargs}
    r = await client.post(
        f"/api/notes/{note_id}/tasks",
        json=payload,
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


# ── Recurring events ──────────────────────────────────────────────────────────

async def test_create_event_with_recurrence_rule(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(
        client, auth_headers, note_id,
        title="Annual Review",
        start="2026-04-12T10:00:00Z",
        recurrence_rule="FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=12;COUNT=3",
    )
    assert ev["recurrence_rule"] == "FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=12;COUNT=3"


async def test_update_event_recurrence_rule(client, auth_headers):
    note_id = await _note(client, auth_headers)
    ev = await _event(client, auth_headers, note_id, start="2026-06-01T10:00:00Z")
    event_id = ev["id"]

    # Add recurrence rule
    r = await client.put(
        f"/api/notes/{note_id}/events/{event_id}",
        json={"recurrence_rule": "FREQ=MONTHLY;BYMONTHDAY=1"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["recurrence_rule"] == "FREQ=MONTHLY;BYMONTHDAY=1"

    # Clear recurrence rule
    r = await client.put(
        f"/api/notes/{note_id}/events/{event_id}",
        json={"recurrence_rule": None},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["recurrence_rule"] is None


async def test_calendar_month_expands_yearly_recurring_event(client, auth_headers):
    """A YEARLY recurring event starting in April should appear in both April 2026 and April 2027."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Anniversary",
        start="2026-04-12T10:00:00Z",
        recurrence_rule="FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=12;COUNT=3",
    )

    # April 2026 — first occurrence
    r = await client.get("/api/events?month=2026-04", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Anniversary"
    assert "2026-04-12" in data[0]["start_datetime"]

    # March 2026 — no occurrence
    r = await client.get("/api/events?month=2026-03", headers=auth_headers)
    data = r.json()
    assert len(data) == 0

    # April 2027 — second occurrence
    r = await client.get("/api/events?month=2027-04", headers=auth_headers)
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Anniversary"
    assert "2027-04-12" in data[0]["start_datetime"]


async def test_calendar_month_expands_monthly_recurring_event(client, auth_headers):
    """A MONTHLY recurring event should appear every month."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Monthly Check",
        start="2026-03-15T10:00:00Z",
        recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=15",
    )

    # March 2026 — first occurrence
    r = await client.get("/api/events?month=2026-03", headers=auth_headers)
    data = r.json()
    assert len(data) == 1
    assert "2026-03-15" in data[0]["start_datetime"]

    # April 2026 — second occurrence
    r = await client.get("/api/events?month=2026-04", headers=auth_headers)
    data = r.json()
    assert len(data) == 1
    assert "2026-04-15" in data[0]["start_datetime"]

    # May 2026 — third occurrence
    r = await client.get("/api/events?month=2026-05", headers=auth_headers)
    data = r.json()
    assert len(data) == 1
    assert "2026-05-15" in data[0]["start_datetime"]


async def test_calendar_month_expands_weekly_recurring_event(client, auth_headers):
    """A WEEKLY recurring event should produce multiple occurrences per month."""
    note_id = await _note(client, auth_headers)
    # Start on Monday April 6, 2026; repeat every Monday
    await _event(
        client, auth_headers, note_id,
        title="Weekly Standup",
        start="2026-04-06T09:00:00Z",
        recurrence_rule="FREQ=WEEKLY;BYDAY=MO",
    )

    r = await client.get("/api/events?month=2026-04", headers=auth_headers)
    data = r.json()
    # Mondays in April 2026: 6, 13, 20, 27 → 4 occurrences
    assert len(data) == 4
    titles = [d["title"] for d in data]
    assert all(t == "Weekly Standup" for t in titles)


async def test_recurring_event_with_count_limit(client, auth_headers):
    """Recurring event with COUNT=2 should only appear 2 times total."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Two-Year Event",
        start="2026-05-01T10:00:00Z",
        recurrence_rule="FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1;COUNT=2",
    )

    # May 2026 — occurrence 1
    r = await client.get("/api/events?month=2026-05", headers=auth_headers)
    assert len(r.json()) == 1

    # May 2027 — occurrence 2
    r = await client.get("/api/events?month=2027-05", headers=auth_headers)
    assert len(r.json()) == 1

    # May 2028 — no more occurrences (COUNT=2 exhausted)
    r = await client.get("/api/events?month=2028-05", headers=auth_headers)
    assert len(r.json()) == 0


async def test_recurring_event_preserves_duration(client, auth_headers):
    """Expanded recurring occurrences should preserve the original event duration."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="2h Meeting",
        start="2026-04-10T09:00:00Z",
        end_datetime="2026-04-10T11:00:00Z",
        recurrence_rule="FREQ=WEEKLY;BYDAY=FR",
    )

    r = await client.get("/api/events?month=2026-04", headers=auth_headers)
    data = r.json()
    assert len(data) >= 1
    for ev in data:
        # Each occurrence should still have end_datetime 2h after start
        from datetime import datetime, timezone
        start_dt = datetime.fromisoformat(ev["start_datetime"].replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(ev["end_datetime"].replace("Z", "+00:00"))
        diff = (end_dt - start_dt).total_seconds()
        assert diff == 7200  # 2 hours


async def test_non_recurring_events_still_work_with_month_filter(client, auth_headers):
    """Non-recurring events should still be returned correctly with the new filtering logic."""
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id, title="One-off", start="2026-07-20T10:00:00Z")

    r = await client.get("/api/events?month=2026-07", headers=auth_headers)
    data = r.json()
    assert len(data) == 1
    assert data[0]["recurrence_rule"] is None


# ── iCalendar export ──────────────────────────────────────────────────────────

async def test_export_calendar_empty(client, auth_headers):
    """Export with no events returns a valid (empty) iCal file."""
    r = await client.get("/api/events/export/calendar.ics", headers=auth_headers)
    assert r.status_code == 200
    assert "text/calendar" in r.headers["content-type"]
    body = r.text
    assert "BEGIN:VCALENDAR" in body
    assert "END:VCALENDAR" in body


async def test_export_calendar_contains_future_non_recurring(client, auth_headers):
    """Future non-recurring events appear in the export."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Future Event",
        start="2099-06-15T10:00:00Z",
        end_datetime="2099-06-15T11:00:00Z",
    )

    r = await client.get("/api/events/export/calendar.ics", headers=auth_headers)
    assert r.status_code == 200
    body = r.text
    assert "Future Event" in body
    assert "BEGIN:VEVENT" in body
    assert "DTSTART" in body


async def test_export_calendar_excludes_past_non_recurring(client, auth_headers):
    """Past non-recurring events are excluded from the export."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Past Event",
        start="2020-01-01T10:00:00Z",
    )

    r = await client.get("/api/events/export/calendar.ics", headers=auth_headers)
    body = r.text
    assert "Past Event" not in body


async def test_export_calendar_includes_recurring_with_rrule(client, auth_headers):
    """Recurring events appear in the export with RRULE property."""
    note_id = await _note(client, auth_headers)
    await _event(
        client, auth_headers, note_id,
        title="Yearly Reminder",
        start="2026-04-12T10:00:00Z",
        recurrence_rule="FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=12;COUNT=5",
    )

    r = await client.get("/api/events/export/calendar.ics", headers=auth_headers)
    body = r.text
    assert "Yearly Reminder" in body
    assert "RRULE" in body
    assert "FREQ=YEARLY" in body


async def test_export_calendar_requires_auth(client):
    """Export endpoint requires authentication (returns 401 or 403 without token)."""
    r = await client.get("/api/events/export/calendar.ics")
    assert r.status_code in (401, 403)


async def test_export_calendar_isolation(client, auth_headers, second_auth_headers):
    """Each user only exports their own events."""
    note_id = await _note(client, auth_headers)
    await _event(client, auth_headers, note_id, title="User1 Event", start="2099-01-01T10:00:00Z")

    # Second user's export should not contain user1's event
    r = await client.get("/api/events/export/calendar.ics", headers=second_auth_headers)
    assert "User1 Event" not in r.text


async def test_export_calendar_respects_content_preferences(client, auth_headers, db_session):
    note_id = await _note(client, auth_headers, title="Source Note")
    await _event(client, auth_headers, note_id, title="Future Event", start="2099-06-15T10:00:00Z")
    await _task(client, auth_headers, note_id, title="Future Task", due_date="2099-06-16T08:30:00Z")
    await client.post("/api/notes/daily", json={"date": "2099-06-17"}, headers=auth_headers)
    db_session.add(NoteField(
        note_id=note_id,
        group_name="Dates",
        key="Renewal",
        value="Annual renewal",
        position=0,
        field_date=date(2099, 6, 18),
    ))
    await db_session.commit()

    response = await client.patch(
        "/api/auth/me/calendar-export",
        json={
            "ical_include_events": False,
            "ical_include_tasks": True,
            "ical_include_journal": True,
            "ical_include_field_dates": True,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200

    r = await client.get("/api/events/export/calendar.ics", headers=auth_headers)
    body = r.text
    assert "Future Event" not in body
    assert "Future Task" in body
    assert "2099-06-17" in body or "Journal note" in body
    assert "Renewal" in body
