from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.database import Category, Note
from app.config import Settings
from app.api import notes as notes_api


async def test_daily_note_post_creates_note_and_folder_hierarchy(client, auth_headers, db_session):
    response = await client.post("/api/notes/daily", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True

    note = await db_session.get(Note, data["note_id"])
    assert note is not None
    assert note.journal_date is not None
    assert note.title == note.journal_date.isoformat()

    month_folder = await db_session.get(Category, note.category_id)
    assert month_folder is not None
    assert month_folder.name == note.journal_date.strftime("%Y-%m")

    year_folder = await db_session.get(Category, month_folder.parent_id)
    assert year_folder is not None
    assert year_folder.name == note.journal_date.strftime("%Y")


async def test_daily_note_post_is_idempotent(client, auth_headers):
    first = await client.post("/api/notes/daily", headers=auth_headers)
    second = await client.post("/api/notes/daily", headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["note_id"] == second.json()["note_id"]
    assert first.json()["created"] is True
    assert second.json()["created"] is False


async def test_daily_note_post_with_explicit_date(client, auth_headers):
    response = await client.post("/api/notes/daily", json={"date": "2026-04-15"}, headers=auth_headers)
    assert response.status_code == 200

    note_id = response.json()["note_id"]
    note_response = await client.get(f"/api/notes/{note_id}", headers=auth_headers)
    assert note_response.status_code == 200
    assert note_response.json()["journal_date"] == "2026-04-15"
    assert note_response.json()["title"] == "2026-04-15"


async def test_daily_note_title_can_be_localized_via_env_setting(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        notes_api,
        "get_settings",
        lambda: Settings(secret_key="test", master_key="test", journal_note_title_format="localized_long"),
    )

    response = await client.post("/api/notes/daily", json={"date": "2026-04-20", "locale": "it"}, headers=auth_headers)
    assert response.status_code == 200

    note_response = await client.get(f"/api/notes/{response.json()['note_id']}", headers=auth_headers)
    assert note_response.status_code == 200
    assert note_response.json()["title"] == "Lunedi 20 Aprile 2026"


async def test_daily_note_title_can_use_custom_template(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        notes_api,
        "get_settings",
        lambda: Settings(
            secret_key="test",
            master_key="test",
            journal_note_title_format="{weekday} {day}/{month_number}/{year}",
        ),
    )

    response = await client.post("/api/notes/daily", json={"date": "2026-04-20", "locale": "en"}, headers=auth_headers)
    assert response.status_code == 200

    note_response = await client.get(f"/api/notes/{response.json()['note_id']}", headers=auth_headers)
    assert note_response.status_code == 200
    assert note_response.json()["title"] == "Monday 20/04/2026"


async def test_journal_dates_filters_by_month_and_user(client, auth_headers, second_auth_headers):
    await client.post("/api/notes/daily", json={"date": "2026-04-01"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-04-15"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-05-01"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-04-10"}, headers=second_auth_headers)

    response = await client.get("/api/notes/journal-dates?month=2026-04", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == ["2026-04-01", "2026-04-15"]


async def test_journal_tree_groups_notes_by_year_month_day(client, auth_headers):
    first = await client.post("/api/notes/daily", json={"date": "2026-04-20"}, headers=auth_headers)
    second = await client.post("/api/notes/daily", json={"date": "2026-04-19"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2025-12-31"}, headers=auth_headers)

    response = await client.get("/api/notes/journal-tree", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["year"] == 2026
    assert data[0]["months"][0]["month"] == "2026-04"
    assert data[0]["months"][0]["days"][0]["date"] == "2026-04-20"
    assert data[0]["months"][0]["days"][0]["note_id"] == first.json()["note_id"]
    assert data[0]["months"][0]["days"][1]["date"] == "2026-04-19"
    assert data[0]["months"][0]["days"][1]["note_id"] == second.json()["note_id"]
    assert data[1]["year"] == 2025


async def test_list_notes_can_filter_by_journal_month(client, auth_headers):
    await client.post("/api/notes/daily", json={"date": "2026-04-20"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-04-10"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-05-01"}, headers=auth_headers)

    response = await client.get("/api/notes?journal_month=2026-04", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["journal_date"] for item in items] == ["2026-04-20", "2026-04-10"]


async def test_journal_date_unique_per_user(db_session, client, auth_headers):
    db_session.add(Note(title="One", content="", user_id=1, journal_date=date(2026, 4, 20)))
    await db_session.flush()

    db_session.add(Note(title="Two", content="", user_id=1, journal_date=date(2026, 4, 20)))
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_daily_note_adjacent_returns_prev_and_next(client, auth_headers):
    first = await client.post("/api/notes/daily", json={"date": "2026-04-10"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-04-15"}, headers=auth_headers)
    last = await client.post("/api/notes/daily", json={"date": "2026-04-20"}, headers=auth_headers)

    response = await client.get("/api/notes/daily/adjacent?date=2026-04-15", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {
        "prev_date": "2026-04-10",
        "prev_id": first.json()["note_id"],
        "next_date": "2026-04-20",
        "next_id": last.json()["note_id"],
    }


async def test_daily_note_creates_stable_folder_hierarchy_by_name_and_parent(client, auth_headers, db_session):
    await client.post("/api/notes/daily", json={"date": "2026-04-11"}, headers=auth_headers)
    await client.post("/api/notes/daily", json={"date": "2026-04-12"}, headers=auth_headers)

    year_folders = (
        await db_session.execute(select(Category).where(Category.user_id == 1, Category.parent_id.is_(None)))
    ).scalars().all()
    month_folders = (
        await db_session.execute(select(Category).where(Category.user_id == 1, Category.parent_id.is_not(None)))
    ).scalars().all()

    assert [folder.name for folder in year_folders] == ["2026"]
    assert [folder.name for folder in month_folders] == ["2026-04"]
