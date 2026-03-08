# NoteVault – API Reference

**Version:** 1.0
**Base URL:** `https://<host>/api`
**Date:** 2026-03-08

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Error Responses](#3-error-responses)
4. [Auth Endpoints](#4-auth-endpoints)
   - POST /api/auth/register
   - POST /api/auth/login
   - GET /api/auth/me
5. [Notes Endpoints](#5-notes-endpoints)
   - GET /api/notes
   - POST /api/notes
   - GET /api/notes/{id}
   - PUT /api/notes/{id}
   - DELETE /api/notes/{id}
6. [Secrets Endpoints](#6-secrets-endpoints)
   - GET /api/notes/{id}/secrets
   - POST /api/notes/{id}/secrets
   - GET /api/notes/{id}/secrets/{sid}
   - DELETE /api/notes/{id}/secrets/{sid}
   - POST /api/notes/{id}/secrets/{sid}/reveal
7. [Tags Endpoints](#7-tags-endpoints)
   - GET /api/tags
   - POST /api/tags
8. [Categories Endpoints](#8-categories-endpoints)
   - GET /api/categories
   - POST /api/categories
9. [Search Endpoint](#9-search-endpoint)
   - GET /api/search
10. [Health Endpoint](#10-health-endpoint)
    - GET /health

---

## 1. Conventions

### Request Format

All request bodies must use `Content-Type: application/json`. Query parameters use standard URL encoding.

### Response Format

All responses use `Content-Type: application/json`. Timestamps are UTC ISO 8601 strings (e.g., `"2026-03-08T12:00:00.000000Z"`). IDs are UUIDs (string).

### Pagination

Paginated list endpoints return the following envelope:

```json
{
  "items": [ ... ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation failure) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (valid token, wrong resource owner) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable Entity (Pydantic validation error) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |

---

## 2. Authentication

Protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Access tokens expire after 60 minutes (configurable). Use `POST /api/auth/refresh` to obtain a new access token using a refresh token.

---

## 3. Error Responses

All error responses follow this schema:

```json
{
  "detail": "Human-readable error message"
}
```

Validation errors (422) include field-level detail:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

---

## 4. Auth Endpoints

---

### POST /api/auth/register

Register a new user account.

**Auth required:** No

**Request body:**

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| username | string | yes | 3–50 characters, alphanumeric and underscores only |
| email | string | yes | Valid email address |
| password | string | yes | Min 12 chars; must include uppercase, lowercase, digit, special char |

**Response – 201 Created:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "email": "alice@example.com",
  "created_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 409 | Username already exists |
| 409 | Email already registered |
| 422 | Validation failure (weak password, invalid email, etc.) |

---

### POST /api/auth/login

Authenticate with username/email and password.

**Auth required:** No

**Request body:**

```json
{
  "username": "string",
  "password": "string"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| username | string | yes | Accepts either the username or the registered email address |
| password | string | yes | Plaintext password |

**Response – 200 OK:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | JWT for use in Authorization header |
| token_type | string | Always `"bearer"` |
| expires_in | integer | Seconds until the access token expires |
| refresh_token | string | Opaque token for obtaining new access tokens |

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Invalid credentials |
| 423 | Account temporarily locked (too many failed attempts) |

---

### GET /api/auth/me

Return the profile of the currently authenticated user.

**Auth required:** Yes

**Request body:** None

**Response – 200 OK:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "email": "alice@example.com",
  "created_at": "2026-03-08T12:00:00.000000Z",
  "last_login_at": "2026-03-08T14:32:10.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Missing or invalid access token |

---

## 5. Notes Endpoints

---

### GET /api/notes

List the authenticated user's notes with optional filtering and pagination.

**Auth required:** Yes

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number (1-based) |
| page_size | integer | 20 | Items per page; max 100 |
| category_id | string (UUID) | — | Filter by category |
| tag_id | string (UUID) | — | Filter by tag |
| is_pinned | boolean | — | Filter pinned/unpinned notes |
| sort | string | `updated_at` | Sort field: `updated_at`, `created_at`, `title` |
| order | string | `desc` | Sort direction: `asc`, `desc` |

**Response – 200 OK:**

```json
{
  "items": [
    {
      "id": "...",
      "title": "My first note",
      "body_preview": "First 200 characters of the body...",
      "category_id": "...",
      "category_name": "Personal",
      "tags": [
        { "id": "...", "name": "work" }
      ],
      "is_pinned": false,
      "secret_count": 2,
      "created_at": "2026-03-08T12:00:00.000000Z",
      "updated_at": "2026-03-08T12:00:00.000000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

**Note:** The `body` field is not included in list responses. Use `GET /api/notes/{id}` to retrieve the full body. Secrets are not returned; only their count.

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 422 | Invalid query parameter value |

---

### POST /api/notes

Create a new note.

**Auth required:** Yes

**Request body:**

```json
{
  "title": "string",
  "body": "string",
  "category_id": "string (UUID) | null",
  "tag_ids": ["string (UUID)"],
  "is_pinned": false
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| title | string | yes | 1–255 characters |
| body | string | no | Markdown; max 1 MB; defaults to `""` |
| category_id | UUID or null | no | Must be owned by the authenticated user |
| tag_ids | UUID[] | no | Each must be owned by the authenticated user; defaults to `[]` |
| is_pinned | boolean | no | Default `false` |

**Response – 201 Created:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "My first note",
  "body": "# Hello\n\nThis is my note.",
  "category_id": null,
  "category_name": null,
  "tags": [],
  "is_pinned": false,
  "secret_count": 0,
  "created_at": "2026-03-08T12:00:00.000000Z",
  "updated_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Referenced category_id or tag_id not found |
| 422 | Validation failure |

---

### GET /api/notes/{id}

Retrieve a single note by its ID.

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Note identifier |

**Response – 200 OK:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "My first note",
  "body": "# Hello\n\nThis is my note.",
  "category_id": null,
  "category_name": null,
  "tags": [
    { "id": "...", "name": "work" }
  ],
  "is_pinned": false,
  "secret_count": 1,
  "created_at": "2026-03-08T12:00:00.000000Z",
  "updated_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note not found or does not belong to the user |

---

### PUT /api/notes/{id}

Update an existing note. Supports partial updates (only provided fields are changed).

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Note identifier |

**Request body (all fields optional):**

```json
{
  "title": "string",
  "body": "string",
  "category_id": "string (UUID) | null",
  "tag_ids": ["string (UUID)"],
  "is_pinned": true
}
```

**Response – 200 OK:** Full note object (same schema as GET /api/notes/{id}).

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note not found or does not belong to the user |
| 404 | Referenced category_id or tag_id not found |
| 422 | Validation failure |

---

### DELETE /api/notes/{id}

Permanently delete a note and all its associated secrets.

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Note identifier |

**Response – 204 No Content:** Empty body.

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note not found or does not belong to the user |

---

## 6. Secrets Endpoints

All secrets endpoints are nested under a note. The note must be owned by the authenticated user.

---

### GET /api/notes/{id}/secrets

List all secrets attached to a note. **Plaintext values are never returned by this endpoint.**

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Parent note identifier |

**Response – 200 OK:**

```json
[
  {
    "id": "...",
    "note_id": "...",
    "name": "DATABASE_URL",
    "description": "Production database connection string",
    "created_at": "2026-03-08T12:00:00.000000Z",
    "updated_at": "2026-03-08T12:00:00.000000Z"
  }
]
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Parent note not found or not owned by the user |

---

### POST /api/notes/{id}/secrets

Create a new secret attached to a note.

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Parent note identifier |

**Request body:**

```json
{
  "name": "string",
  "value": "string",
  "description": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | yes | 1–100 characters; unique within the note |
| value | string | yes | Plaintext secret value; max 10 KB |
| description | string | no | 0–255 characters |

**Response – 201 Created:**

```json
{
  "id": "...",
  "note_id": "...",
  "name": "DATABASE_URL",
  "description": "Production database connection string",
  "created_at": "2026-03-08T12:00:00.000000Z",
  "updated_at": "2026-03-08T12:00:00.000000Z"
}
```

**Note:** The plaintext `value` is never returned. It is encrypted immediately upon receipt.

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Parent note not found or not owned by the user |
| 409 | A secret with the same name already exists on this note |
| 422 | Validation failure |

---

### GET /api/notes/{id}/secrets/{sid}

Retrieve a single secret's metadata. **Does not return the plaintext value.**

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Parent note identifier |
| sid | UUID | Secret identifier |

**Response – 200 OK:**

```json
{
  "id": "...",
  "note_id": "...",
  "name": "DATABASE_URL",
  "description": "Production database connection string",
  "created_at": "2026-03-08T12:00:00.000000Z",
  "updated_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note or secret not found, or not owned by the user |

---

### DELETE /api/notes/{id}/secrets/{sid}

Permanently delete a secret, including its encrypted value.

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Parent note identifier |
| sid | UUID | Secret identifier |

**Response – 204 No Content:** Empty body.

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note or secret not found, or not owned by the user |

---

### POST /api/notes/{id}/secrets/{sid}/reveal

Decrypt and return the plaintext value of a secret. This endpoint is rate-limited and fully audited.

**Auth required:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Parent note identifier |
| sid | UUID | Secret identifier |

**Request body:** Empty (no body required).

**Rate limit:** 10 requests per user per minute. Exceeding this limit returns 429 with a `Retry-After` header indicating when the limit resets.

**Response – 200 OK:**

```json
{
  "id": "...",
  "note_id": "...",
  "name": "DATABASE_URL",
  "value": "postgresql://user:password@host:5432/db",
  "revealed_at": "2026-03-08T14:32:10.000000Z"
}
```

**Response headers on rate limit – 429 Too Many Requests:**

```
Retry-After: 47
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1741440777
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 404 | Note or secret not found, or not owned by the user |
| 429 | Rate limit exceeded |
| 500 | Decryption failure (indicates data corruption or key mismatch) |

---

## 7. Tags Endpoints

---

### GET /api/tags

List all tags belonging to the authenticated user.

**Auth required:** Yes

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 50 | Items per page; max 200 |

**Response – 200 OK:**

```json
{
  "items": [
    {
      "id": "...",
      "name": "work",
      "note_count": 14,
      "created_at": "2026-03-08T12:00:00.000000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 50
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |

---

### POST /api/tags

Create a new tag.

**Auth required:** Yes

**Request body:**

```json
{
  "name": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | yes | 1–50 characters; normalised to lowercase; unique per user |

**Response – 201 Created:**

```json
{
  "id": "...",
  "name": "devops",
  "note_count": 0,
  "created_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 409 | Tag with the same name already exists for this user |
| 422 | Validation failure |

---

## 8. Categories Endpoints

---

### GET /api/categories

List all categories belonging to the authenticated user.

**Auth required:** Yes

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 50 | Items per page; max 200 |

**Response – 200 OK:**

```json
{
  "items": [
    {
      "id": "...",
      "name": "Personal",
      "note_count": 7,
      "created_at": "2026-03-08T12:00:00.000000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 50
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |

---

### POST /api/categories

Create a new category.

**Auth required:** Yes

**Request body:**

```json
{
  "name": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | yes | 1–100 characters; unique per user |

**Response – 201 Created:**

```json
{
  "id": "...",
  "name": "Work",
  "note_count": 0,
  "created_at": "2026-03-08T12:00:00.000000Z"
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 401 | Unauthenticated |
| 409 | Category with the same name already exists for this user |
| 422 | Validation failure |

---

## 9. Search Endpoint

---

### GET /api/search

Perform a full-text search across the authenticated user's notes.

**Auth required:** Yes

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | yes | Search query; plain language; min 1 character after trimming |
| page | integer | no | Default 1 |
| page_size | integer | no | Default 20; max 100 |
| category_id | UUID | no | Restrict search to a specific category |
| tag_id | UUID | no | Restrict search to notes with a specific tag |

**Response – 200 OK:**

```json
{
  "items": [
    {
      "id": "...",
      "title": "Deployment runbook",
      "headline": "...connect to the <b>PostgreSQL</b> database using the credentials...",
      "rank": 0.0759,
      "category_id": "...",
      "category_name": "DevOps",
      "tags": [
        { "id": "...", "name": "ops" }
      ],
      "is_pinned": false,
      "secret_count": 3,
      "updated_at": "2026-03-08T12:00:00.000000Z"
    }
  ],
  "total": 4,
  "page": 1,
  "page_size": 20
}
```

| Field | Description |
|-------|-------------|
| headline | Snippet from the note body with matching terms wrapped in `<b>` tags. HTML must be escaped before rendering. |
| rank | Relevance score (higher is more relevant) from `ts_rank_cd`. |

**Error codes:**

| Code | Condition |
|------|-----------|
| 400 | Missing or blank `q` parameter |
| 401 | Unauthenticated |
| 422 | Invalid query parameter value |

---

## 10. Health Endpoint

---

### GET /health

Returns the health status of the service and its dependencies. This endpoint does not require authentication and is intended for load balancer and monitoring probes.

**Auth required:** No

**Response – 200 OK (healthy):**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-08T14:32:10.000000Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Response – 503 Service Unavailable (degraded):**

```json
{
  "status": "degraded",
  "version": "1.0.0",
  "timestamp": "2026-03-08T14:32:10.000000Z",
  "checks": {
    "database": "ok",
    "redis": "error: connection refused"
  }
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| 200 | All checks pass |
| 503 | One or more dependency checks failed |
