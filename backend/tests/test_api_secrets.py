import pytest
import pytest_asyncio
from app.models.enums import SecretType


@pytest_asyncio.fixture
async def note_id(client, auth_headers):
    resp = await client.post("/api/notes", json={"title": "Secret Note", "content": ""}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_secret_no_value_in_response(client, auth_headers, note_id):
    response = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "My API Key",
        "secret_type": "api_key",
        "value": "super-secret-value",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert "value" not in data
    assert "encrypted_value" not in data
    assert data["name"] == "My API Key"
    assert data["secret_type"] == "api_key"


async def test_create_secret_all_types(client, auth_headers, note_id):
    """Every SecretType enum value must be accepted by the API."""
    for secret_type in SecretType:
        resp = await client.post(f"/api/notes/{note_id}/secrets", json={
            "name": f"Test {secret_type.value}",
            "secret_type": secret_type.value,
            "value": "some-value",
        }, headers=auth_headers)
        assert resp.status_code == 201, f"Failed for type {secret_type.value}: {resp.text}"
        assert resp.json()["secret_type"] == secret_type.value


async def test_list_secrets_no_value(client, auth_headers, note_id):
    await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Secret",
        "secret_type": "token",
        "value": "hidden-value",
    }, headers=auth_headers)

    response = await client.get(f"/api/notes/{note_id}/secrets", headers=auth_headers)
    assert response.status_code == 200
    secrets = response.json()
    assert len(secrets) > 0
    for secret in secrets:
        assert "value" not in secret
        assert "encrypted_value" not in secret


async def test_reveal_secret_returns_correct_value(client, auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Reveal Me",
        "secret_type": "password",
        "value": "my-revealed-value",
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    secret_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/notes/{note_id}/secrets/{secret_id}/reveal",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == "my-revealed-value"
    assert data["name"] == "Reveal Me"
    assert data["secret_type"] == "password"


async def test_reveal_preserves_unicode(client, auth_headers, note_id):
    value = "p@$$w0rd-🔑-日本語"
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Unicode",
        "secret_type": "password",
        "value": value,
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    reveal = await client.post(
        f"/api/notes/{note_id}/secrets/{secret_id}/reveal",
        headers=auth_headers,
    )
    assert reveal.json()["value"] == value


async def test_reveal_wrong_user(client, auth_headers, second_auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Mine",
        "secret_type": "password",
        "value": "private",
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/notes/{note_id}/secrets/{secret_id}/reveal",
        headers=second_auth_headers,
    )
    assert response.status_code == 404


async def test_delete_secret(client, auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Delete Me",
        "secret_type": "other",
        "value": "gone",
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    response = await client.delete(
        f"/api/notes/{note_id}/secrets/{secret_id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Should be gone now
    assert (await client.get(
        f"/api/notes/{note_id}/secrets/{secret_id}", headers=auth_headers
    )).status_code == 404


async def test_delete_secret_wrong_user(client, auth_headers, second_auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Mine",
        "secret_type": "other",
        "value": "private",
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    response = await client.delete(
        f"/api/notes/{note_id}/secrets/{secret_id}",
        headers=second_auth_headers,
    )
    assert response.status_code == 404
    # Secret must still be there
    assert (await client.get(
        f"/api/notes/{note_id}/secrets/{secret_id}", headers=auth_headers
    )).status_code == 200


async def test_get_secret_not_found(client, auth_headers, note_id):
    response = await client.get(f"/api/notes/{note_id}/secrets/99999", headers=auth_headers)
    assert response.status_code == 404


async def test_secrets_on_nonexistent_note(client, auth_headers):
    response = await client.get("/api/notes/99999/secrets", headers=auth_headers)
    assert response.status_code == 404
