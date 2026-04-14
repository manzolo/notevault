"""Tests for note_fields CRUD, ownership isolation, and FTS search integration."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_note(client: AsyncClient, headers: dict, title: str = "Test Note") -> dict:
    resp = await client.post("/api/notes", json={"title": title, "content": "content"}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _create_field(
    client: AsyncClient,
    headers: dict,
    note_id: int,
    group_name: str = "Gruppo",
    key: str = "chiave",
    value: str = "valore",
    position: int = 0,
) -> dict:
    resp = await client.post(
        f"/api/notes/{note_id}/fields",
        json={"group_name": group_name, "key": key, "value": value, "position": position},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_field(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    resp = await client.post(
        f"/api/notes/{note['id']}/fields",
        json={"group_name": "Illuminazione", "key": "Sala faretti", "value": "GU10", "position": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["group_name"] == "Illuminazione"
    assert data["key"] == "Sala faretti"
    assert data["value"] == "GU10"
    assert data["note_id"] == note["id"]
    assert data["position"] == 0


@pytest.mark.asyncio
async def test_list_fields(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    await _create_field(client, auth_headers, note["id"], key="k1", value="v1", position=0)
    await _create_field(client, auth_headers, note["id"], key="k2", value="v2", position=1)
    resp = await client.get(f"/api/notes/{note['id']}/fields", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    # returned in position order
    assert items[0]["key"] == "k1"
    assert items[1]["key"] == "k2"


@pytest.mark.asyncio
async def test_update_field(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    field = await _create_field(client, auth_headers, note["id"], key="old key", value="old value")
    resp = await client.put(
        f"/api/notes/{note['id']}/fields/{field['id']}",
        json={"key": "new key", "value": "new value", "group_name": "Nuovo Gruppo"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["key"] == "new key"
    assert data["value"] == "new value"
    assert data["group_name"] == "Nuovo Gruppo"


@pytest.mark.asyncio
async def test_update_field_partial(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    field = await _create_field(client, auth_headers, note["id"], key="chiave", value="originale")
    resp = await client.put(
        f"/api/notes/{note['id']}/fields/{field['id']}",
        json={"value": "aggiornato"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["key"] == "chiave"
    assert data["value"] == "aggiornato"


@pytest.mark.asyncio
async def test_delete_field(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    field = await _create_field(client, auth_headers, note["id"])
    resp = await client.delete(f"/api/notes/{note['id']}/fields/{field['id']}", headers=auth_headers)
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/notes/{note['id']}/fields", headers=auth_headers)
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_reorder_fields(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    f1 = await _create_field(client, auth_headers, note["id"], key="A", position=0)
    f2 = await _create_field(client, auth_headers, note["id"], key="B", position=1)
    f3 = await _create_field(client, auth_headers, note["id"], key="C", position=2)

    # Swap: put C first, A last
    resp = await client.patch(
        f"/api/notes/{note['id']}/fields/reorder",
        json=[
            {"id": f3["id"], "position": 0},
            {"id": f2["id"], "position": 1},
            {"id": f1["id"], "position": 2},
        ],
        headers=auth_headers,
    )
    assert resp.status_code == 200

    list_resp = await client.get(f"/api/notes/{note['id']}/fields", headers=auth_headers)
    keys = [item["key"] for item in list_resp.json()]
    assert keys == ["C", "B", "A"]


# ---------------------------------------------------------------------------
# Ownership isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_access_other_users_note_fields(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    await _create_field(client, auth_headers, note["id"], key="secret key", value="secret value")

    # Second user cannot list fields of first user's note
    resp = await client.get(f"/api/notes/{note['id']}/fields", headers=second_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_create_field_on_other_users_note(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    resp = await client.post(
        f"/api/notes/{note['id']}/fields",
        json={"key": "attacco", "value": "valore"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_update_field_on_other_users_note(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    field = await _create_field(client, auth_headers, note["id"])
    resp = await client.put(
        f"/api/notes/{note['id']}/fields/{field['id']}",
        json={"value": "hacked"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_field_on_other_users_note(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers)
    field = await _create_field(client, auth_headers, note["id"])
    resp = await client.delete(
        f"/api/notes/{note['id']}/fields/{field['id']}",
        headers=second_auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 404 on non-existent resources
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_nonexistent_note_fields(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/notes/99999/fields", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_field(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    resp = await client.put(
        f"/api/notes/{note['id']}/fields/99999",
        json={"value": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_field(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    resp = await client.delete(f"/api/notes/{note['id']}/fields/99999", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cascade delete: fields deleted when note is deleted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fields_cascade_delete_with_note(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers)
    await _create_field(client, auth_headers, note["id"], key="k1")
    await _create_field(client, auth_headers, note["id"], key="k2")
    await client.delete(f"/api/notes/{note['id']}", headers=auth_headers)
    # Note gone — fields gone too (cascade); trying to list returns 404
    resp = await client.get(f"/api/notes/{note['id']}/fields", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# FTS search integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_finds_note_via_field_value(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers, title="Ricambi di casa")
    await _create_field(
        client, auth_headers, note["id"],
        group_name="Illuminazione", key="Sala faretti", value="GU10",
    )
    resp = await client.get("/api/search?q=GU10", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    result = next((r for r in data["items"] if r["id"] == note["id"]), None)
    assert result is not None
    assert result["match_in_fields"] is True
    assert any(f["value"] == "GU10" for f in result["matching_fields"])


@pytest.mark.asyncio
async def test_search_finds_note_via_field_key(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers, title="Auto")
    await _create_field(
        client, auth_headers, note["id"],
        group_name="Pneumatici", key="Bulloni ruota", value="M12x1.5",
    )
    resp = await client.get("/api/search?q=Bulloni", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    result = next((r for r in data["items"] if r["id"] == note["id"]), None)
    assert result is not None
    assert result["match_in_fields"] is True


@pytest.mark.asyncio
async def test_search_finds_note_via_field_group_name(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers, title="Panda")
    await _create_field(
        client, auth_headers, note["id"],
        group_name="Pneumatici", key="Misura", value="195/65 R15",
    )
    resp = await client.get("/api/search?q=Pneumatici", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    result = next((r for r in data["items"] if r["id"] == note["id"]), None)
    assert result is not None
    assert result["match_in_fields"] is True


@pytest.mark.asyncio
async def test_search_does_not_leak_other_user_fields(
    client: AsyncClient, auth_headers: dict, second_auth_headers: dict
):
    note = await _create_note(client, auth_headers, title="Privato")
    await _create_field(
        client, auth_headers, note["id"],
        group_name="Segreti", key="Codice", value="XYZUNICO999",
    )
    resp = await client.get("/api/search?q=XYZUNICO999", headers=second_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_note_with_no_fields_has_match_in_fields_false(client: AsyncClient, auth_headers: dict):
    note = await _create_note(client, auth_headers, title="Nota senza campi GU10check")
    resp = await client.get("/api/search?q=GU10check", headers=auth_headers)
    assert resp.status_code == 200
    result = next((r for r in resp.json()["items"] if r["id"] == note["id"]), None)
    assert result is not None
    assert result["match_in_fields"] is False
    assert result["matching_fields"] == []
