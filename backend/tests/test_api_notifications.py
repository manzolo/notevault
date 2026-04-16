import pytest
from sqlalchemy import insert, select
from app.models.database import Notification, User


async def _seed_notifications(db_session, user_id: int, count: int = 3, read: bool = False):
    """Insert notification rows directly for test setup."""
    for i in range(count):
        await db_session.execute(
            insert(Notification).values(
                user_id=user_id,
                title=f"Notif {i+1}",
                body=f"Body {i+1}",
                is_read=read,
            )
        )
    await db_session.commit()


async def _get_user_id(db_session, username: str) -> int:
    result = await db_session.execute(select(User).where(User.username == username))
    return result.scalar_one().id


async def test_count_empty(client, auth_headers):
    r = await client.get("/api/notifications/count", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["unread"] == 0


async def test_list_empty(client, auth_headers):
    r = await client.get("/api/notifications", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_count_with_unread(client, auth_headers, db_session):
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=3, read=False)
    r = await client.get("/api/notifications/count", headers=auth_headers)
    assert r.json()["unread"] == 3


async def test_list_notifications(client, auth_headers, db_session):
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=2)
    r = await client.get("/api/notifications", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["is_read"] is False


async def test_mark_read(client, auth_headers, db_session):
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=1)
    r = await client.get("/api/notifications", headers=auth_headers)
    notif_id = r.json()[0]["id"]

    r = await client.post(f"/api/notifications/{notif_id}/read", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get("/api/notifications/count", headers=auth_headers)
    assert r.json()["unread"] == 0


async def test_mark_all_read(client, auth_headers, db_session):
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=5)
    r = await client.get("/api/notifications/count", headers=auth_headers)
    assert r.json()["unread"] == 5

    r = await client.post("/api/notifications/read-all", headers=auth_headers)
    assert r.status_code == 204

    r = await client.get("/api/notifications/count", headers=auth_headers)
    assert r.json()["unread"] == 0


async def test_unread_filter(client, auth_headers, db_session):
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=2, read=False)
    await _seed_notifications(db_session, user_id, count=1, read=True)

    r = await client.get("/api/notifications?unread=true", headers=auth_headers)
    data = r.json()
    assert len(data) == 2
    assert all(not n["is_read"] for n in data)


async def test_notification_isolation(client, auth_headers, second_auth_headers, db_session):
    """User 2 should not see user 1's notifications."""
    user_id = await _get_user_id(db_session, "testuser")
    await _seed_notifications(db_session, user_id, count=3)
    r = await client.get("/api/notifications", headers=second_auth_headers)
    assert r.json() == []
