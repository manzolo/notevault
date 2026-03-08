# NoteVault – Architecture Document

**Version:** 1.0
**Date:** 2026-03-08
**Status:** Approved

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Breakdown](#2-component-breakdown)
   - 2.1 [Frontend – Next.js](#21-frontend--nextjs)
   - 2.2 [Backend – FastAPI](#22-backend--fastapi)
   - 2.3 [Database – PostgreSQL](#23-database--postgresql)
   - 2.4 [Cache – Redis](#24-cache--redis)
3. [Data Flow](#3-data-flow)
   - 3.1 [Authentication Flow](#31-authentication-flow)
   - 3.2 [Note Read Flow](#32-note-read-flow)
   - 3.3 [Secret Reveal Flow](#33-secret-reveal-flow)
4. [Security Model](#4-security-model)
   - 4.1 [Encryption at Rest](#41-encryption-at-rest)
   - 4.2 [JWT Authentication](#42-jwt-authentication)
   - 4.3 [Rate Limiting](#43-rate-limiting)
   - 4.4 [Audit Logs](#44-audit-logs)
5. [Database Schema Overview](#5-database-schema-overview)
6. [API Structure](#6-api-structure)
7. [Infrastructure Layout](#7-infrastructure-layout)
8. [Technology Decisions](#8-technology-decisions)

---

## 1. System Overview

NoteVault is a four-component system deployed as a Docker Compose stack. All inter-service communication occurs on an internal Docker network; only the frontend and backend are reachable from the outside world (via a reverse proxy in production).

```
                          ┌───────────────────────────────────────────────────┐
                          │                   Browser / Client                │
                          └──────────────────────────┬────────────────────────┘
                                                     │ HTTPS (TLS 1.2+)
                                    ┌────────────────▼─────────────────┐
                                    │        Reverse Proxy / CDN        │
                                    │      (nginx / Caddy / Traefik)    │
                                    └───────┬──────────────┬────────────┘
                                            │              │
                          ┌─────────────────▼──┐    ┌──────▼─────────────────┐
                          │  Frontend Service   │    │   Backend Service       │
                          │  Next.js :3000      │    │   FastAPI + Uvicorn     │
                          │                     │    │   :8000                 │
                          │  • React components │    │                         │
                          │  • SWR data fetch   │    │  • REST API handlers    │
                          │  • JWT storage      │    │  • Business logic       │
                          │    (httpOnly cookie │    │  • Encryption layer     │
                          │     or memory)      │    │  • Auth middleware       │
                          └─────────────────────┘    └──────┬─────────┬───────┘
                                                            │         │
                                              ┌─────────────▼──┐  ┌───▼────────────┐
                                              │  PostgreSQL 15  │  │   Redis 7      │
                                              │  :5432          │  │   :6379        │
                                              │                 │  │                │
                                              │  • Users        │  │  • JWT blocklist│
                                              │  • Notes        │  │  • Rate limit  │
                                              │  • Secrets      │  │    counters    │
                                              │    (encrypted)  │  │  • Refresh     │
                                              │  • Tags         │  │    token cache │
                                              │  • Categories   │  └────────────────┘
                                              │  • Audit log    │
                                              │  • FTS indexes  │
                                              └─────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Frontend – Next.js

| Attribute | Detail |
|-----------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Data fetching | SWR (stale-while-revalidate) |
| Markdown rendering | react-markdown + remark-gfm |
| State management | React Context + SWR cache |
| Build output | Static export or Node.js server (configurable) |

The frontend is a single-page application. It communicates exclusively with the backend REST API using JSON over HTTPS. JWT access tokens are held in memory (not localStorage) to mitigate XSS exfiltration; refresh tokens are held in an httpOnly, Secure, SameSite=Strict cookie.

Key frontend modules:

- **auth/** – Login, registration, token refresh logic, and auth context provider.
- **notes/** – Note list, editor (CodeMirror or similar), and detail view.
- **secrets/** – Secret creation form and reveal modal with explicit user confirmation.
- **search/** – Full-text search bar with debounced query and highlighted snippets.
- **admin/** – Audit log viewer (read-only, future feature).

### 2.2 Backend – FastAPI

| Attribute | Detail |
|-----------|--------|
| Framework | FastAPI 0.110+ |
| Language | Python 3.12 |
| ASGI server | Uvicorn (with Gunicorn process manager in production) |
| ORM | SQLAlchemy 2.0 (async) with asyncpg driver |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Auth | python-jose (JWT) + passlib (Argon2id) |
| Encryption | cryptography library (AES-256-GCM, HKDF) |
| Rate limiting | slowapi (Redis backend) |
| Cache / KV | redis-py (async) |

The backend is organised as a collection of routers, each corresponding to a functional domain:

```
app/
├── main.py               # FastAPI app factory, middleware registration
├── config.py             # Settings (Pydantic BaseSettings, reads .env)
├── database.py           # Async SQLAlchemy engine and session factory
├── redis.py              # Redis connection pool
├── dependencies.py       # Shared FastAPI dependencies (get_db, get_current_user)
├── models/               # SQLAlchemy ORM models
│   ├── user.py
│   ├── note.py
│   ├── secret.py
│   ├── tag.py
│   ├── category.py
│   └── audit.py
├── schemas/              # Pydantic request/response schemas
├── routers/              # FastAPI routers (one per domain)
│   ├── auth.py
│   ├── notes.py
│   ├── secrets.py
│   ├── tags.py
│   ├── categories.py
│   └── search.py
├── services/             # Business logic (called by routers)
│   ├── auth_service.py
│   ├── note_service.py
│   ├── secret_service.py
│   └── audit_service.py
└── crypto/               # Encryption primitives
    ├── aes_gcm.py        # AES-256-GCM encrypt/decrypt
    └── kdf.py            # HKDF-SHA256 key derivation
```

### 2.3 Database – PostgreSQL

| Attribute | Detail |
|-----------|--------|
| Version | PostgreSQL 15 |
| Extensions | `pg_trgm` (trigram similarity), `pgcrypto` (uuid_generate_v4) |
| Connection pooling | PgBouncer (optional, recommended for production) |
| Backups | pg_dump / pg_basebackup |

PostgreSQL serves as the single source of truth for all persistent application data. Full-text search is handled natively using `tsvector` columns with GIN indexes, avoiding the need for an external search engine.

### 2.4 Cache – Redis

| Attribute | Detail |
|-----------|--------|
| Version | Redis 7 |
| Persistence | RDB snapshots (not required for durability; data is ephemeral) |
| Use cases | JWT blacklist, rate-limit counters, refresh token metadata cache |

Redis holds only ephemeral, reproducible data. A complete Redis failure degrades functionality (rate limiting falls back to deny, blacklisted tokens may briefly be accepted) but does not cause data loss.

---

## 3. Data Flow

### 3.1 Authentication Flow

```
Client                    Backend                   PostgreSQL          Redis
  │                          │                           │                │
  │── POST /api/auth/login ──►│                           │                │
  │   {username, password}   │── SELECT user WHERE ──────►│                │
  │                          │   username=?              │                │
  │                          │◄─────────────── user row ─│                │
  │                          │                           │                │
  │                          │  verify Argon2id hash     │                │
  │                          │  generate JWT (access)    │                │
  │                          │  generate refresh token   │                │
  │                          │── INSERT refresh_token ───►│                │
  │                          │── INCR login_attempts ────────────────────►│
  │◄── 200 {access_token,   ─│                           │                │
  │         refresh_token}   │                           │                │
```

### 3.2 Note Read Flow

```
Client                    Backend                   PostgreSQL
  │                          │                           │
  │── GET /api/notes ────────►│                           │
  │   Authorization: Bearer  │                           │
  │                          │  validate JWT             │
  │                          │── SELECT notes WHERE ─────►│
  │                          │   user_id=? LIMIT ? ──────►│
  │                          │◄─── paginated rows ────────│
  │◄── 200 {items, total} ───│                           │
```

### 3.3 Secret Reveal Flow

```
Client              Backend                Redis              PostgreSQL
  │                    │                     │                    │
  │── POST             │                     │                    │
  │   /secrets/        │                     │                    │
  │   {sid}/reveal ───►│                     │                    │
  │                    │  validate JWT        │                    │
  │                    │── INCR rate_limit ──►│                    │
  │                    │◄── current count ───│                    │
  │                    │  [if count > 10]     │                    │
  │◄── 429 ────────────│  return 429         │                    │
  │                    │                     │                    │
  │                    │── SELECT secret ────────────────────────►│
  │                    │◄── {ciphertext, nonce} ─────────────────│
  │                    │                     │                    │
  │                    │  HKDF derive key     │                    │
  │                    │  AES-GCM decrypt     │                    │
  │                    │── INSERT audit log ─────────────────────►│
  │◄── 200 {value} ────│                     │                    │
  │                    │  plaintext discarded │                    │
```

---

## 4. Security Model

### 4.1 Encryption at Rest

Secret values are encrypted using **AES-256-GCM** before being stored in the database. This scheme provides both confidentiality and authenticated integrity (the ciphertext cannot be tampered with without detection).

**Key derivation:**

A unique 256-bit encryption key is derived for each secret using **HKDF-SHA256**:

```
input_key_material = MASTER_KEY                         # 32 bytes, from env
info = f"secret:{user_id}:{note_id}:{secret_id}"       # derivation context
derived_key = HKDF(IKM=input_key_material, info=info, length=32)
```

This construction means:

- Each secret has a distinct encryption key.
- Compromise of one derived key does not compromise other secrets.
- The MASTER_KEY is the single secret that must be protected at the infrastructure level.

**Storage format:**

```
encrypted_value column = base64( nonce[12 bytes] || ciphertext || auth_tag[16 bytes] )
```

The nonce is randomly generated per encryption operation (96-bit, as recommended for AES-GCM).

**MASTER_KEY management:**

- Provided via the `MASTER_KEY` environment variable.
- Never logged, never stored in the database, never included in API responses.
- If the MASTER_KEY changes, all existing secrets become unreadable. Key rotation requires a re-encryption migration.

### 4.2 JWT Authentication

Access tokens are short-lived JWTs (default: 60 minutes) signed with HMAC-SHA256 using `SECRET_KEY`.

| Claim | Purpose |
|-------|---------|
| `sub` | User ID (UUID) |
| `username` | Username (for display; re-validated against DB on sensitive ops) |
| `iat` | Issued-at timestamp |
| `exp` | Expiry timestamp |
| `jti` | Unique token identifier (used for blacklisting on logout) |

On logout, the `jti` is inserted into Redis with a TTL matching the token's remaining validity. All protected endpoints check the Redis blacklist before accepting a token.

### 4.3 Rate Limiting

Rate limiting is applied at two levels:

| Level | Scope | Limit | Backend |
|-------|-------|-------|---------|
| Global | Per IP address | 200 req/min | Redis |
| Secret reveal | Per authenticated user | 10 reveals/min | Redis |

The secret-reveal rate limit is intentionally strict to prevent bulk credential harvesting in the event of a compromised user session.

### 4.4 Audit Logs

The audit log is append-only at the application level. The PostgreSQL role granted to the application has:

```sql
GRANT INSERT, SELECT ON TABLE audit_logs TO notevault_app;
-- No UPDATE or DELETE granted
```

All security-relevant operations (login, logout, note deletion, secret creation/reveal/deletion) are recorded synchronously within the same database transaction as the operation itself, ensuring consistency.

---

## 5. Database Schema Overview

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│   users     │       │     notes        │       │   secrets    │
│─────────────│       │──────────────────│       │──────────────│
│ id (uuid)   │──┐    │ id (uuid)        │──┐    │ id (uuid)    │
│ username    │  │    │ user_id (fk)  ◄──┘  └───►│ note_id (fk) │
│ email       │  └───►│ category_id (fk) │       │ name         │
│ password_   │       │ title            │       │ description  │
│   hash      │       │ body             │       │ encrypted_   │
│ is_active   │       │ body_tsv         │       │   value      │
│ created_at  │       │ is_pinned        │       │ created_at   │
│ updated_at  │       │ created_at       │       │ updated_at   │
│ last_login  │       │ updated_at       │       └──────────────┘
└─────────────┘       └────────┬─────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
┌─────────▼──────┐  ┌──────────▼──────┐  ┌──────────▼──────────┐
│  categories    │  │  note_tags (M2M) │  │  tags               │
│────────────────│  │─────────────────│  │─────────────────────│
│ id (uuid)      │  │ note_id (fk)    │  │ id (uuid)            │
│ user_id (fk)   │  │ tag_id (fk)     │  │ user_id (fk)         │
│ name           │  └─────────────────┘  │ name                 │
│ created_at     │                       │ created_at           │
└────────────────┘                       └─────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  audit_logs                                                   │
│──────────────────────────────────────────────────────────────│
│ id (bigserial)  │ event_type  │ user_id  │ note_id  │ ...    │
│ secret_id       │ ip_address  │ outcome  │ metadata │        │
│ created_at (timestamptz)                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  refresh_tokens                                               │
│──────────────────────────────────────────────────────────────│
│ id (uuid)  │ user_id (fk)  │ token_hash  │ expires_at       │
│ created_at │ revoked_at    │ ip_address                      │
└──────────────────────────────────────────────────────────────┘
```

**Indexes:**

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| notes | body_tsv | GIN | Full-text search |
| notes | (user_id, updated_at) | BTree | User note listing with sort |
| notes | (user_id, category_id) | BTree | Category filter |
| note_tags | (note_id, tag_id) | BTree (unique) | M2M join |
| secrets | (note_id) | BTree | Secrets per note |
| audit_logs | (user_id, created_at) | BTree | User audit queries |
| refresh_tokens | (token_hash) | BTree (unique) | Token lookup |

---

## 6. API Structure

The REST API is versioned through the `/api` prefix. All endpoints are documented in detail in `docs/API.md`.

```
/api
├── /auth
│   ├── POST   /register
│   ├── POST   /login
│   ├── POST   /logout
│   ├── POST   /refresh
│   └── GET    /me
│
├── /notes
│   ├── GET    /                   list notes
│   ├── POST   /                   create note
│   ├── GET    /{id}               get note
│   ├── PUT    /{id}               update note
│   ├── DELETE /{id}               delete note
│   └── /secrets
│       ├── GET    /               list secrets (metadata only)
│       ├── POST   /               create secret
│       ├── GET    /{sid}          get secret metadata
│       ├── DELETE /{sid}          delete secret
│       └── POST   /{sid}/reveal   decrypt and return secret value
│
├── /tags
│   ├── GET    /                   list tags
│   └── POST   /                   create tag
│
├── /categories
│   ├── GET    /                   list categories
│   └── POST   /                   create category
│
├── /search
│   └── GET    /                   full-text search notes
│
└── /health
    └── GET    /                   service health check
```

All authenticated endpoints require the header:

```
Authorization: Bearer <access_token>
```

All request and response bodies use `Content-Type: application/json`.

---

## 7. Infrastructure Layout

```
docker-compose.yml
├── service: frontend     (image: notevault-frontend, port 3000)
├── service: backend      (image: notevault-backend, port 8000)
├── service: db           (image: postgres:15-alpine, port 5432, volume: pgdata)
├── service: redis        (image: redis:7-alpine, port 6379, no persistence)
└── network: notevault-net (internal bridge)
```

In production, a fifth service (nginx or Caddy) runs as a TLS-terminating reverse proxy and serves as the single public entry point. The `frontend` and `backend` containers are not exposed directly on the host.

---

## 8. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | FastAPI | Async-native, automatic OpenAPI docs, Pydantic integration |
| Frontend framework | Next.js | Strong TypeScript ecosystem, App Router for future SSR options |
| Database | PostgreSQL | Native FTS avoids external search dependency; strong ACID guarantees |
| ORM | SQLAlchemy async | Industry standard; Alembic integration for migrations |
| Encryption | AES-256-GCM | NIST-recommended AEAD; authenticated encryption prevents tampering |
| KDF | HKDF-SHA256 | Per-secret key isolation without storing individual keys |
| Password hashing | Argon2id | Winner of Password Hashing Competition; memory-hard |
| Rate limiting | Redis + slowapi | Distributed-safe counters; works across multiple backend replicas |
| Cache / ephemeral KV | Redis | Lightweight; TTL-native for token blacklist management |
