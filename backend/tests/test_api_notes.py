import pytest


async def test_create_note_minimal(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Minimal Note",
        "content": "",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Minimal Note"
    assert data["content"] == ""
    assert data["is_pinned"] is False
    assert data["category_id"] is None
    assert data["tags"] == []


async def test_create_note_with_content(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Full Note",
        "content": "Some content here",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Some content here"


async def test_create_note_pinned(client, auth_headers):
    response = await client.post("/api/notes", json={
        "title": "Pinned Note",
        "content": "",
        "is_pinned": True,
    }, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["is_pinned"] is True


async def test_list_notes_empty(client, auth_headers):
    response = await client.get("/api/notes", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_notes_returns_only_own(client, auth_headers, second_auth_headers):
    await client.post("/api/notes", json={"title": "User1 Note", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "User2 Note", "content": ""}, headers=second_auth_headers)

    response = await client.get("/api/notes", headers=auth_headers)
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["title"] == "User1 Note"


async def test_list_notes_pagination(client, auth_headers):
    for i in range(5):
        await client.post("/api/notes", json={"title": f"Note {i}", "content": ""}, headers=auth_headers)

    response = await client.get("/api/notes?page=1&per_page=3", headers=auth_headers)
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3
    assert data["pages"] == 2


async def test_get_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Get Me", "content": "Content"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == note_id
    assert response.json()["title"] == "Get Me"


async def test_get_note_not_found(client, auth_headers):
    response = await client.get("/api/notes/99999", headers=auth_headers)
    assert response.status_code == 404


async def test_update_note_title(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Original", "content": "Content"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"title": "Updated"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"
    assert response.json()["content"] == "Content"  # unchanged


async def test_update_note_pin(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Note", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"is_pinned": True}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_pinned"] is True


async def test_update_note_wrong_user(client, auth_headers, second_auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Mine", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"title": "Hacked"}, headers=second_auth_headers)
    assert response.status_code == 404


async def test_delete_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Delete Me", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.delete(f"/api/notes/{note_id}", headers=auth_headers)
    assert response.status_code == 204

    assert (await client.get(f"/api/notes/{note_id}", headers=auth_headers)).status_code == 404


async def test_delete_note_cascades_secrets(client, auth_headers):
    """Deleting a note must also delete its secrets (CASCADE)."""
    note_resp = await client.post("/api/notes", json={"title": "With Secret", "content": ""}, headers=auth_headers)
    note_id = note_resp.json()["id"]

    secret_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Key", "secret_type": "api_key", "value": "abc123",
    }, headers=auth_headers)
    assert secret_resp.status_code == 201
    secret_id = secret_resp.json()["id"]

    await client.delete(f"/api/notes/{note_id}", headers=auth_headers)

    # Secrets endpoint on a deleted note returns 404
    response = await client.get(f"/api/notes/{note_id}/secrets/{secret_id}", headers=auth_headers)
    assert response.status_code == 404


async def test_ownership_enforcement(client, auth_headers, second_auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "Private", "content": "Secret"}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    assert (await client.get(f"/api/notes/{note_id}", headers=second_auth_headers)).status_code == 404
    assert (await client.put(f"/api/notes/{note_id}", json={"title": "x"}, headers=second_auth_headers)).status_code == 404
    assert (await client.delete(f"/api/notes/{note_id}", headers=second_auth_headers)).status_code == 404


async def test_note_with_tags(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "python"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Tagged Note",
        "content": "",
        "tag_ids": [tag_id],
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    tags = note_resp.json()["tags"]
    assert len(tags) == 1
    assert tags[0]["name"] == "python"


async def test_note_with_category(client, auth_headers):
    cat_resp = await client.post("/api/categories", json={"name": "Work"}, headers=auth_headers)
    cat_id = cat_resp.json()["id"]

    note_resp = await client.post("/api/notes", json={
        "title": "Work Note",
        "content": "",
        "category_id": cat_id,
    }, headers=auth_headers)
    assert note_resp.status_code == 201
    assert note_resp.json()["category_id"] == cat_id


async def test_list_notes_filtered_by_tag(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "filteredtag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    tagged = await client.post("/api/notes", json={"title": "Tagged", "content": "", "tag_ids": [tag_id]}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Untagged", "content": ""}, headers=auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == tagged.json()["id"]


async def test_list_notes_filtered_by_tag_no_match(client, auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "emptytag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    await client.post("/api/notes", json={"title": "Untagged", "content": ""}, headers=auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_list_notes_tag_filter_user_isolation(client, auth_headers, second_auth_headers):
    tag_resp = await client.post("/api/tags", json={"name": "isolatedtag"}, headers=auth_headers)
    tag_id = tag_resp.json()["id"]
    await client.post("/api/notes", json={"title": "User A Note", "content": "", "tag_ids": [tag_id]}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "User B Note", "content": ""}, headers=second_auth_headers)

    response = await client.get(f"/api/notes?tag_id={tag_id}", headers=second_auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_list_notes_pinned_only(client, auth_headers):
    await client.post("/api/notes", json={"title": "Normal", "content": "", "is_pinned": False}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Pinned", "content": "", "is_pinned": True}, headers=auth_headers)

    response = await client.get("/api/notes?pinned_only=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Pinned"
    assert data["items"][0]["is_pinned"] is True


async def test_list_notes_pinned_sort_first(client, auth_headers):
    await client.post("/api/notes", json={"title": "Normal", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Pinned", "content": "", "is_pinned": True}, headers=auth_headers)

    response = await client.get("/api/notes", headers=auth_headers)
    items = response.json()["items"]
    assert items[0]["is_pinned"] is True
    assert items[0]["title"] == "Pinned"


async def test_create_note_default_not_archived(client, auth_headers):
    response = await client.post("/api/notes", json={"title": "Normal Note", "content": ""}, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["is_archived"] is False


async def test_archive_note(client, auth_headers):
    create_resp = await client.post("/api/notes", json={"title": "To Archive", "content": ""}, headers=auth_headers)
    note_id = create_resp.json()["id"]

    response = await client.put(f"/api/notes/{note_id}", json={"is_archived": True}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is True

    # Unarchive
    response = await client.put(f"/api/notes/{note_id}", json={"is_archived": False}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is False


async def test_list_notes_excludes_archived_by_default(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    archived_resp = await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)
    archived_id = archived_resp.json()["id"]

    response = await client.get("/api/notes", headers=auth_headers)
    data = response.json()
    ids = [item["id"] for item in data["items"]]
    assert archived_id not in ids
    assert data["total"] == 1


async def test_list_notes_archived_only(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)

    response = await client.get("/api/notes?archived_only=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Archived"
    assert data["items"][0]["is_archived"] is True


async def test_list_notes_include_archived(client, auth_headers):
    await client.post("/api/notes", json={"title": "Active", "content": ""}, headers=auth_headers)
    await client.post("/api/notes", json={"title": "Archived", "content": "", "is_archived": True}, headers=auth_headers)

    response = await client.get("/api/notes?include_archived=true", headers=auth_headers)
    data = response.json()
    assert data["total"] == 2


# --- Date filter + event interaction tests ---

async def test_date_filter_note_without_events_matches_created_at(client, auth_headers):
    """Note with no events: filter by creation date works normally."""
    resp = await client.post("/api/notes", json={"title": "Old note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    # The note was just created (today), so filtering with a very wide range should find it
    import datetime
    today = datetime.date.today().isoformat()
    response = await client.get(f"/api/notes?created_after={today}T00:00:00&created_before={today}T23:59:59", headers=auth_headers)
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_note_with_event_in_range_is_shown(client, auth_headers):
    """Note that has an event starting in the search range → must appear."""
    resp = await client.post("/api/notes", json={"title": "Event note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    # Create event on 2026-03-12
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-12T10:00:00", "end_datetime": "2026-03-12T11:00:00"},
        headers=auth_headers,
    )
    response = await client.get(
        "/api/notes?created_after=2026-03-12T00:00:00&created_before=2026-03-13T23:59:59",
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_note_with_event_outside_range_is_hidden(client, auth_headers):
    """Note whose event is on 2026-03-15 must NOT appear in a 2026-03-12/13 filter,
    even if the note itself was created earlier (within range)."""
    resp = await client.post("/api/notes", json={"title": "Future event note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    # Create event outside the filter range
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-15T10:00:00", "end_datetime": "2026-03-17T11:00:00"},
        headers=auth_headers,
    )
    # Filter 12-13: the note's creation date might be "now" (irrelevant), event is 15-17 → not in range
    response = await client.get(
        "/api/notes?created_after=2026-03-12T00:00:00&created_before=2026-03-13T23:59:59",
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id not in ids


async def test_date_filter_open_end_includes_future_events(client, auth_headers):
    """Filter with only created_after and no created_before: events after that date must appear."""
    resp = await client.post("/api/notes", json={"title": "Open end note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Far future", "start_datetime": "2030-01-01T10:00:00"},
        headers=auth_headers,
    )
    response = await client.get(
        "/api/notes?created_after=2026-03-01T00:00:00",
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_multi_day_event_overlap(client, auth_headers):
    """Event from Mar 15 16:00 UTC to Mar 16 21:00 UTC must appear when filtering from Mar 16 00:00 UTC (no end).
    Uses UTC naive datetimes to avoid + sign URL encoding issues."""
    resp = await client.post("/api/notes", json={"title": "Multi-day", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-15T16:00:00", "end_datetime": "2026-03-16T21:00:00"},
        headers=auth_headers,
    )
    # Filter: from Mar 16 00:00 UTC — event ends Mar 16 21:00 UTC which is after filter start, should appear
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-16T00:00:00"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids

    # Filter: Mar 12-13 — event does not overlap, should NOT appear
    response2 = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids2 = [n["id"] for n in response2.json()["items"]]
    assert note_id not in ids2


async def test_date_filter_event_entirely_before_range(client, auth_headers):
    """Event ends before filter start → hidden."""
    resp = await client.post("/api/notes", json={"title": "Before range note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-10T10:00:00", "end_datetime": "2026-03-10T11:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13: event ended Mar 10 → NOT in range
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id not in ids


async def test_date_filter_event_entirely_after_range(client, auth_headers):
    """Event starts after filter end → hidden."""
    resp = await client.post("/api/notes", json={"title": "After range note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-15T10:00:00", "end_datetime": "2026-03-15T11:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13: event starts Mar 15 → NOT in range
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id not in ids


async def test_date_filter_event_starts_in_range_ends_after(client, auth_headers):
    """Event starts inside range, ends after range end → shown."""
    resp = await client.post("/api/notes", json={"title": "Starts in range note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-13T18:00:00", "end_datetime": "2026-03-14T18:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13 23:59:59: event starts Mar 13 18:00 (in range), ends Mar 14 (outside) → IN range
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_event_spans_entire_range(client, auth_headers):
    """Event starts before range start AND ends after range end → shown."""
    resp = await client.post("/api/notes", json={"title": "Spanning note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-11T00:00:00", "end_datetime": "2026-03-15T00:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13: event spans the whole range → IN range
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_event_no_end_in_range(client, auth_headers):
    """Event with no end_datetime, starts within range → shown."""
    resp = await client.post("/api/notes", json={"title": "No end in range note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-12T10:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13: event starts Mar 12 (in range), no end → IN range
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id in ids


async def test_date_filter_event_no_end_before_range(client, auth_headers):
    """Event with no end_datetime, starts before range → hidden."""
    resp = await client.post("/api/notes", json={"title": "No end before range note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-10T10:00:00"},
        headers=auth_headers,
    )
    # Filter: Mar 12-13: event starts Mar 10 (before range), no end → NOT in range
    # coalesce(null, Mar10) = Mar10, which is < Mar12 → event ends before range start → hidden
    response = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-12T00:00:00", "created_before": "2026-03-13T23:59:59"},
        headers=auth_headers,
    )
    ids = [n["id"] for n in response.json()["items"]]
    assert note_id not in ids


async def test_date_filter_timezone_midnight_boundary(client, auth_headers):
    """Event at 2026-03-14T00:00:00+01:00 (= 2026-03-13T23:00:00Z) should appear in Mar 14 CET filter
    but NOT appear in Mar 13 CET filter.
    Uses params={} dict to properly encode the + sign in timezone offset."""
    resp = await client.post("/api/notes", json={"title": "TZ midnight note", "content": ""}, headers=auth_headers)
    note_id = resp.json()["id"]
    await client.post(
        f"/api/notes/{note_id}/events",
        json={"title": "Ev", "start_datetime": "2026-03-14T00:00:00+01:00"},
        headers=auth_headers,
    )

    # Should appear in Mar 14 CET filter (2026-03-14T00:00:00+01:00 to 2026-03-14T23:59:59+01:00)
    # = 2026-03-13T23:00:00Z to 2026-03-14T22:59:59Z
    # event start = 2026-03-13T23:00:00Z: coalesce(null, 23:00Z) = 23:00Z >= 23:00Z AND 23:00Z <= 22:59:59Z+1day
    r1 = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-14T00:00:00+01:00", "created_before": "2026-03-14T23:59:59+01:00"},
        headers=auth_headers,
    )
    ids1 = [n["id"] for n in r1.json()["items"]]
    assert note_id in ids1

    # Should NOT appear in Mar 13 CET filter (2026-03-13T00:00:00+01:00 to 2026-03-13T23:59:59+01:00)
    # = 2026-03-12T23:00:00Z to 2026-03-13T22:59:59Z
    # event start = 2026-03-13T23:00:00Z > 22:59:59Z → NOT in range
    r2 = await client.get(
        "/api/notes",
        params={"created_after": "2026-03-13T00:00:00+01:00", "created_before": "2026-03-13T23:59:59+01:00"},
        headers=auth_headers,
    )
    ids2 = [n["id"] for n in r2.json()["items"]]
    assert note_id not in ids2


async def test_list_notes_recursive_includes_subcategories(client, auth_headers):
    """Filter by parent category with recursive=true → notes in child category appear."""
    # Create parent category
    parent_resp = await client.post("/api/categories", json={"name": "Parent Cat"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]

    # Create child category under parent
    child_resp = await client.post("/api/categories", json={"name": "Child Cat", "parent_id": parent_id}, headers=auth_headers)
    child_id = child_resp.json()["id"]

    # Create note in parent category and note in child category
    parent_note_resp = await client.post("/api/notes", json={"title": "Parent note", "content": "", "category_id": parent_id}, headers=auth_headers)
    parent_note_id = parent_note_resp.json()["id"]

    child_note_resp = await client.post("/api/notes", json={"title": "Child note", "content": "", "category_id": child_id}, headers=auth_headers)
    child_note_id = child_note_resp.json()["id"]

    # Filter by parent with recursive=true → both notes appear
    response = await client.get(
        "/api/notes",
        params={"category_id": parent_id, "recursive": "true"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    ids = [n["id"] for n in response.json()["items"]]
    assert parent_note_id in ids
    assert child_note_id in ids


async def test_list_notes_recursive_false_excludes_subcategories(client, auth_headers):
    """Filter by parent category with recursive=false (default) → notes in child category do NOT appear."""
    # Create parent category
    parent_resp = await client.post("/api/categories", json={"name": "Parent Cat2"}, headers=auth_headers)
    parent_id = parent_resp.json()["id"]

    # Create child category under parent
    child_resp = await client.post("/api/categories", json={"name": "Child Cat2", "parent_id": parent_id}, headers=auth_headers)
    child_id = child_resp.json()["id"]

    # Create note in parent category and note in child category
    parent_note_resp = await client.post("/api/notes", json={"title": "Parent note2", "content": "", "category_id": parent_id}, headers=auth_headers)
    parent_note_id = parent_note_resp.json()["id"]

    child_note_resp = await client.post("/api/notes", json={"title": "Child note2", "content": "", "category_id": child_id}, headers=auth_headers)
    child_note_id = child_note_resp.json()["id"]

    # Filter by parent with recursive=false (default) → only parent note appears
    response = await client.get(
        "/api/notes",
        params={"category_id": parent_id, "recursive": "false"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    ids = [n["id"] for n in response.json()["items"]]
    assert parent_note_id in ids
    assert child_note_id not in ids
