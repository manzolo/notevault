import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def note_id(client, auth_headers):
    resp = await client.post("/api/notes", json={"title": "Secret Note", "content": "Hi"}, headers=auth_headers)
    return resp.json()["id"]


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_list_secrets_no_value(client, auth_headers, note_id):
    await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Secret",
        "value": "hidden-value",
    }, headers=auth_headers)

    response = await client.get(f"/api/notes/{note_id}/secrets", headers=auth_headers)
    assert response.status_code == 200
    for secret in response.json():
        assert "value" not in secret
        assert "encrypted_value" not in secret


@pytest.mark.asyncio
async def test_reveal_secret(client, auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Reveal Me",
        "value": "my-revealed-value",
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/notes/{note_id}/secrets/{secret_id}/reveal",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == "my-revealed-value"


@pytest.mark.asyncio
async def test_reveal_wrong_user(client, auth_headers, second_auth_headers, note_id):
    create_resp = await client.post(f"/api/notes/{note_id}/secrets", json={
        "name": "Mine",
        "value": "private",
    }, headers=auth_headers)
    secret_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/notes/{note_id}/secrets/{secret_id}/reveal",
        headers=second_auth_headers
    )
    assert response.status_code == 404
