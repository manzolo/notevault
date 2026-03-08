# NoteVault – Functional Specification

**Version:** 1.0
**Date:** 2026-03-08
**Status:** Approved

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Stakeholders and User Personas](#2-stakeholders-and-user-personas)
3. [System Overview](#3-system-overview)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 [User Authentication](#41-user-authentication)
   - 4.2 [Notes Management](#42-notes-management)
   - 4.3 [Tags](#43-tags)
   - 4.4 [Categories](#44-categories)
   - 4.5 [Full-Text Search](#45-full-text-search)
   - 4.6 [Secrets Vault](#46-secrets-vault)
   - 4.7 [Audit Logging](#47-audit-logging)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Constraints and Assumptions](#6-constraints-and-assumptions)
7. [Glossary](#7-glossary)

---

## 1. Purpose and Scope

NoteVault is a self-hosted, multi-user knowledge-base application that combines a rich markdown note-taking experience with an encrypted secrets vault. It is designed for teams and individuals who need to store sensitive credentials (API keys, passwords, certificates) alongside contextual documentation in a single, audited, access-controlled environment.

**In scope:**

- User account management (registration, authentication, profile)
- Markdown note creation, editing, versioning, and deletion
- Hierarchical organisation via tags and categories
- Full-text search powered by PostgreSQL
- Per-note encrypted secrets storage with controlled reveal semantics
- Comprehensive audit logging of all security-relevant operations
- REST API consumed by a Next.js single-page application

**Out of scope (v1.0):**

- Real-time collaborative editing
- SAML / OIDC federated identity
- Mobile native applications
- Webhooks and external integrations

---

## 2. Stakeholders and User Personas

| Persona | Description | Primary Use Case |
|---------|-------------|------------------|
| **Individual User** | Developer or knowledge worker using a personal instance | Store personal notes, credentials, and research |
| **Team Member** | Employee on a shared instance with per-user data isolation | Maintain team runbooks with embedded secrets |
| **Instance Administrator** | Manages the deployment, performs backups, monitors audit logs | Ensure compliance and operational health |

---

## 3. System Overview

NoteVault is a three-tier web application:

```
Browser (Next.js SPA)
        |
        | HTTPS / REST JSON
        v
FastAPI application server
        |               |
        v               v
  PostgreSQL DB      Redis cache
  (data + FTS)       (rate limits,
                      token blacklist)
```

All persistent data lives in PostgreSQL. Redis is used exclusively for ephemeral state: JWT token blacklisting on logout, and rate-limit counters for the secret-reveal endpoint. The frontend communicates exclusively through the documented REST API; there is no server-side rendering of sensitive data.

---

## 4. Functional Requirements

### 4.1 User Authentication

#### 4.1.1 Registration

A visitor may create a new account by supplying a unique username, a unique email address, and a password.

**Acceptance criteria:**

- The system rejects usernames shorter than 3 characters or longer than 50 characters.
- The system rejects email addresses that do not conform to RFC 5322.
- Passwords must be at least 12 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.
- Passwords are stored as Argon2id hashes; plaintext passwords are never persisted or logged.
- Duplicate usernames and duplicate email addresses each produce distinct 409 Conflict responses.
- Upon successful registration the system returns the new user's profile (id, username, email, created_at). No token is issued at registration; the user must log in.

#### 4.1.2 Login

A registered user authenticates by supplying their username or email and their password.

**Acceptance criteria:**

- On success, the system issues a signed JWT access token (HS256, configurable expiry, default 60 minutes) and a refresh token (opaque random bytes, stored hashed in the database, default 30-day expiry).
- On failure (wrong credentials), the system returns 401 Unauthorized with a generic error message. The specific field (username vs. password) that failed is not disclosed.
- After five consecutive failed login attempts within a 15-minute window, the account is temporarily locked for 15 minutes. This event is recorded in the audit log.
- The access token payload contains: `sub` (user id), `username`, `iat`, `exp`.

#### 4.1.3 Token Refresh

A client holding a valid refresh token may exchange it for a new access token without re-entering credentials.

**Acceptance criteria:**

- The refresh token is single-use; upon exchange it is rotated (old token invalidated, new token issued).
- Expired or revoked refresh tokens return 401.

#### 4.1.4 Logout

A client may explicitly invalidate its current session.

**Acceptance criteria:**

- The access token's `jti` claim is added to a Redis blacklist keyed to the token's remaining TTL.
- The refresh token record is deleted from the database.
- Subsequent requests bearing the blacklisted access token receive 401.

#### 4.1.5 Profile

An authenticated user may retrieve their own profile information.

**Acceptance criteria:**

- Returns id, username, email, created_at, last_login_at.
- Password hash is never included in any response.

---

### 4.2 Notes Management

#### 4.2.1 Create Note

An authenticated user may create a new note.

**Fields:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| title | string | yes | 1–255 characters |
| body | string | no | Markdown; max 1 MB |
| category_id | integer | no | Must reference an existing category owned by the user |
| tag_ids | integer[] | no | Must reference existing tags owned by the user |
| is_pinned | boolean | no | Default false |

**Acceptance criteria:**

- The note is associated with the authenticated user; notes are not visible across user accounts.
- A `tsvector` column is populated server-side from the title and body for full-text search.
- The response includes the created note with all fields, including `created_at` and `updated_at` timestamps (UTC ISO 8601).

#### 4.2.2 List Notes

An authenticated user may retrieve a paginated list of their notes.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | 1-based page number |
| page_size | integer | 20 | Max 100 |
| category_id | integer | — | Filter by category |
| tag_id | integer | — | Filter by tag |
| is_pinned | boolean | — | Filter pinned notes |
| sort | string | updated_at | One of: updated_at, created_at, title |
| order | string | desc | asc or desc |

**Acceptance criteria:**

- Response includes a `total` count, `page`, `page_size`, and a `items` array.
- Secrets attached to notes are not included in list responses; only their count is returned (`secret_count`).

#### 4.2.3 Get Note

Returns a single note by its id.

**Acceptance criteria:**

- If the note does not exist or belongs to another user, returns 404.
- Secrets are not included; the client must request them separately.

#### 4.2.4 Update Note

An authenticated user may update any field of a note they own.

**Acceptance criteria:**

- Partial updates (PATCH semantics) are supported via the PUT endpoint; only provided fields are changed.
- `updated_at` is refreshed on every successful update.
- The `tsvector` column is recomputed when `title` or `body` change.

#### 4.2.5 Delete Note

An authenticated user may delete a note they own.

**Acceptance criteria:**

- Deletion cascades to all secrets attached to the note. Encrypted secret values are purged from the database.
- The event is recorded in the audit log with the note id and title (but not the body or any secrets).
- Returns 204 No Content on success.

---

### 4.3 Tags

Tags are user-scoped, free-form labels that can be attached to multiple notes.

**Acceptance criteria:**

- Tag names are 1–50 characters, unique per user (case-insensitive normalisation to lowercase).
- A user may have at most 500 tags.
- Deleting a tag removes the association from all notes; notes themselves are not deleted.
- The tag list endpoint returns each tag with its `note_count`.

---

### 4.4 Categories

Categories provide a single-level hierarchy for organising notes. Each note may belong to at most one category.

**Acceptance criteria:**

- Category names are 1–100 characters, unique per user.
- A user may have at most 100 categories.
- Deleting a category sets `category_id` to null on all child notes; the notes themselves are not deleted.
- The category list endpoint returns each category with its `note_count`.

---

### 4.5 Full-Text Search

NoteVault provides full-text search across note titles and bodies using PostgreSQL's built-in `tsvector` / `tsquery` capabilities.

**Acceptance criteria:**

- The search endpoint accepts a `q` parameter containing a plain-language query string.
- The system converts `q` to a `tsquery` using `plainto_tsquery('english', q)`.
- Results are ranked by `ts_rank_cd` and returned in descending relevance order.
- Each result includes a `headline` snippet (using `ts_headline`) with matched terms highlighted.
- Search is scoped to the authenticated user's notes only.
- Results support the same pagination parameters as the notes list endpoint.
- An empty or whitespace-only `q` returns 400 Bad Request.

---

### 4.6 Secrets Vault

Each note may have zero or more secrets attached to it. A secret is a named key–value pair whose value is encrypted at rest using AES-256-GCM. The encryption key is derived per-secret from a server-side master key.

#### 4.6.1 Store Secret

**Fields:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | yes | 1–100 characters; unique per note |
| value | string | yes | Plaintext secret; max 10 KB; never stored unencrypted |
| description | string | no | 0–255 characters |

**Acceptance criteria:**

- The plaintext `value` is encrypted using AES-256-GCM before persistence. The nonce and ciphertext are stored together; the plaintext is discarded immediately after encryption.
- The per-secret encryption key is derived using HKDF-SHA256 from the server MASTER_KEY, the user id, the note id, and the secret id as derivation context.
- The API response after creation returns all fields except the plaintext value; it returns only the `name`, `description`, `id`, `note_id`, `created_at`, and `updated_at`.
- The event is recorded in the audit log.

#### 4.6.2 List Secrets

Returns metadata for all secrets attached to a note. Plaintext values are never returned by this endpoint.

#### 4.6.3 Reveal Secret

A dedicated endpoint decrypts and returns the plaintext value of a single secret.

**Acceptance criteria:**

- The endpoint is subject to per-user rate limiting: maximum 10 reveal operations per minute, enforced via Redis. Exceeding the limit returns 429 Too Many Requests with a `Retry-After` header.
- Every call (successful or failed) is recorded in the audit log with: user id, note id, secret id (not the value), timestamp, IP address, and outcome.
- The plaintext value is returned only in the response body and is never cached or stored anywhere other than the decrypted-in-memory response.

#### 4.6.4 Delete Secret

**Acceptance criteria:**

- The encrypted value and all associated metadata are permanently deleted.
- The event is recorded in the audit log.
- Returns 204 No Content.

---

### 4.7 Audit Logging

NoteVault maintains an append-only audit log of all security-relevant events.

**Logged events:**

| Event | Captured Fields |
|-------|----------------|
| USER_REGISTER | user_id, username, ip_address |
| USER_LOGIN | user_id, ip_address, outcome (success/failure) |
| USER_LOGIN_LOCKED | user_id, ip_address |
| USER_LOGOUT | user_id |
| NOTE_CREATE | user_id, note_id, note_title |
| NOTE_UPDATE | user_id, note_id, changed_fields |
| NOTE_DELETE | user_id, note_id, note_title |
| SECRET_CREATE | user_id, note_id, secret_id, secret_name |
| SECRET_REVEAL | user_id, note_id, secret_id, ip_address, outcome |
| SECRET_DELETE | user_id, note_id, secret_id, secret_name |

**Acceptance criteria:**

- Audit records are insert-only; no update or delete operations are permitted on the audit log table at the application level.
- The database role used by the application has INSERT and SELECT privileges on the audit log table but no UPDATE or DELETE.
- Audit log entries include a monotonically increasing sequence id and a UTC timestamp with microsecond precision.
- The audit log is not exposed via the public API in v1.0; it is accessible only to the database administrator.

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | List and search endpoints must return within 500 ms at p95 for datasets up to 100 000 notes per user. |
| **Security** | All communication must occur over TLS 1.2 or higher. Secrets must never appear in logs, error messages, or debug output. |
| **Availability** | Target 99.5% uptime for self-hosted single-node deployments. |
| **Scalability** | The application must be stateless at the API layer to permit horizontal scaling behind a load balancer. |
| **Maintainability** | All database schema changes must be managed via Alembic migrations. No manual DDL in production. |
| **Compliance** | Sensitive fields (passwords, secret values) must not be present in application logs at any log level. |
| **Backup** | The system must support pg_dump-based consistent backups without service downtime using PostgreSQL's MVCC. |

---

## 6. Constraints and Assumptions

- The application is deployed using Docker Compose. Kubernetes support is a future consideration.
- PostgreSQL 15 or later is required for the `pg_trgm` extension and advanced FTS features.
- Redis 7 or later is required.
- The MASTER_KEY must be a 32-byte base64-encoded value provided via environment variable. If absent, the application refuses to start.
- The application assumes a single region; cross-region replication is out of scope.

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **Note** | A user-owned document with a title and optional Markdown body. |
| **Secret** | An encrypted key–value pair attached to a note. |
| **Reveal** | The act of decrypting and returning a secret's plaintext value via the API. |
| **Tag** | A free-form label that can be attached to multiple notes. |
| **Category** | A single-level grouping construct for notes. |
| **MASTER_KEY** | A server-side symmetric key used as the root material for secret encryption key derivation. |
| **tsvector** | A PostgreSQL data type representing a pre-processed document for full-text search. |
| **Audit Log** | An append-only record of security-relevant operations within the system. |
