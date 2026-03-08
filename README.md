# NoteVault — Self-hosted Knowledge Base with Encrypted Secrets

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![Frontend: Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)
![Database: PostgreSQL 15](https://img.shields.io/badge/Database-PostgreSQL%2015-336791.svg)
![Encryption: AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-critical.svg)

NoteVault is a **self-hosted, multi-user knowledge base** that combines a Markdown note editor with a fully encrypted secrets vault. Notes are organised with tags and categories, searchable via PostgreSQL full-text search, and all sensitive values are stored encrypted at rest using AES-256-GCM. The entire stack runs in Docker and is managed through a single `Makefile`.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Make Targets](#make-targets)
- [Architecture](#architecture)
- [Security](#security)
- [Internationalisation](#internationalisation)
- [API Overview](#api-overview)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Features

- **Multi-user with JWT authentication** — each user has an isolated workspace; tokens use HS256 and expire after 7 days.
- **Markdown note editor with live preview** — write in Markdown and see a rendered preview side by side in real time.
- **Tags and categories** — organise notes freely with colour-coded tags and hierarchical categories.
- **Full-text search** — powered by PostgreSQL `tsvector` columns and a `GIN` index for fast, relevance-ranked results across titles and content.
- **Encrypted secrets vault** — store API keys, passwords, and other sensitive values encrypted with AES-256-GCM using a `MASTER_KEY` that never touches the database.
- **Per-user rate-limited secret reveal** — secrets are revealed on demand and auto-hidden after 30 seconds; the reveal endpoint is rate-limited via Redis to prevent brute-force access.
- **Audit logging** — every create, update, delete, and reveal action is logged with timestamps and user context; secret values are always redacted from audit records.
- **Internationalisation (English + Italian)** — the frontend ships with full `en` and `it` translations; locale is determined by the URL prefix (`/en/...`, `/it/...`).
- **Docker-based deployment** — a single `docker compose up -d` starts the entire stack (PostgreSQL, Redis, backend, frontend).

---

## Quick Start

### Prerequisites

- Docker >= 24 and Docker Compose v2
- Python 3.x (only needed for the `make keygen` helper, uses the standard library)
- GNU Make

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/manzolo/notevault.git
cd noteVault

# 2. Generate cryptographic keys
make keygen
# Output example:
#   SECRET_KEY=<base64-encoded 32-byte value>
#   MASTER_KEY=<base64-encoded 32-byte value>

# 3. Create your environment file and paste the generated keys
cp .env.example .env
# Edit .env and fill in SECRET_KEY, MASTER_KEY, DB_PASSWORD, etc.

# 4. Build images and start all services
make up

# 5. Run database migrations
make migrate

# 6. Open the application
# http://localhost:3000
```

> **Note:** On first run, Docker will build the backend and frontend images. This may take a few minutes. Subsequent starts use the cached images.

---

## Make Targets

All day-to-day operations are available as Make targets. Run `make help` to see the full list at any time.

| Target | Description |
|---|---|
| `up` | Start all services in detached mode |
| `down` | Stop and remove containers |
| `restart` | Restart all services |
| `build` | (Re)build service images |
| `migrate` | Apply all pending Alembic migrations |
| `migrate-down` | Roll back the most recent Alembic migration |
| `test` | Run the full test suite (backend + frontend) |
| `test-backend` | Run backend pytest suite |
| `test-frontend` | Run frontend Jest/React test suite in CI mode |
| `logs` | Follow logs for all services |
| `logs-backend` | Follow logs for the backend service only |
| `shell-backend` | Open a bash shell inside the backend container |
| `shell-db` | Open a psql session inside the database container |
| `keygen` | Generate `SECRET_KEY` and `MASTER_KEY` values for `.env` |
| `deploy` | Sync codebase to a remote host and restart services |
| `clean` | Remove containers, volumes, and orphaned services |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP / JSON
┌───────────────────────────▼─────────────────────────────┐
│          Frontend  ·  Next.js 14  ·  :3000              │
│          App Router · TypeScript · Tailwind CSS         │
│          next-intl (en / it locale routing)             │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API
┌───────────────────────────▼─────────────────────────────┐
│          Backend  ·  FastAPI  ·  :8000                  │
│          SQLAlchemy async · Alembic migrations          │
│          AES-256-GCM encryption · bcrypt 12 rounds      │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────▼───────────┐  ┌──────────▼──────────────────┐
│  PostgreSQL 15  :5432  │  │  Redis 7        :6379        │
│  tsvector + GIN index  │  │  Rate limiting · sessions    │
└────────────────────────┘  └─────────────────────────────┘
```

### Component Summary

| Layer | Technology | Notes |
|---|---|---|
| Backend | FastAPI + SQLAlchemy async | Python 3.12, async I/O throughout |
| Database | PostgreSQL 15 | `tsvector` + `GIN` index for full-text search |
| Migrations | Alembic | Version-controlled schema changes |
| Frontend | Next.js 14 App Router + TypeScript | Tailwind CSS, server and client components |
| Cache / Rate limiting | Redis 7 | Rate-limits the secret reveal endpoint per user |
| Authentication | JWT HS256 | 7-day expiry, `SECRET_KEY` from environment |
| Encryption | AES-256-GCM + PBKDF2 | `MASTER_KEY` from environment, never stored |

---

## Security

NoteVault is designed with a defence-in-depth approach to protect both user credentials and stored secrets.

- **Keys never logged** — `SECRET_KEY` and `MASTER_KEY` are read from environment variables and are never written to application logs or the database.
- **Secrets encrypted at rest** — every secret value is encrypted with AES-256-GCM before being persisted. The `MASTER_KEY` is the sole encryption root and must be kept safe; losing it means losing access to all secrets.
- **Secret values redacted in audit logs** — when a secret is created, updated, or revealed, the audit log records the event and the secret's name, but the value itself is always replaced with `[REDACTED]`.
- **Rate limiting on the reveal endpoint** — Redis enforces a per-user rate limit on `POST /api/secrets/{id}/reveal` to prevent automated extraction of secrets.
- **Auto-hide after 30 seconds** — once a secret is revealed in the UI, a client-side timer automatically hides the plaintext value after 30 seconds.
- **bcrypt 12 rounds** — user passwords are hashed with bcrypt at a cost factor of 12.
- **CORS** — the backend accepts requests only from origins listed in the `CORS_ORIGINS` environment variable.

> **Key rotation:** To rotate `MASTER_KEY`, decrypt all secrets with the old key, re-encrypt with the new key, and update `.env` before restarting. There is no automated rotation tool in the current release.

---

## Internationalisation

NoteVault uses [next-intl](https://next-intl-docs.vercel.app/) with the `localePrefix: 'always'` strategy. Every page URL includes the locale as the first path segment.

| Locale | URL prefix | Translation file |
|---|---|---|
| English | `/en/...` | `frontend/messages/en.json` |
| Italian | `/it/...` | `frontend/messages/it.json` |

The default locale is `en`. If a user visits `/`, the middleware redirects them to `/en/`.

### Adding a new language

1. Create `frontend/messages/<locale>.json` by copying `en.json` and translating all values.
2. Add the locale code to the `locales` array in `frontend/i18n.ts`:
   ```typescript
   export const locales = ['en', 'it', 'de'] as const; // example: adding German
   ```
3. Rebuild the frontend image: `make build`.

---

## API Overview

The REST API is served by FastAPI at `http://localhost:8000`. Interactive documentation is available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when `DEBUG=true`.

| Endpoint group | Base path | Description |
|---|---|---|
| Authentication | `/api/auth` | Register, login, refresh token |
| Notes | `/api/notes` | CRUD for notes, Markdown content |
| Tags | `/api/tags` | Create, list, assign tags to notes |
| Categories | `/api/categories` | Manage note categories |
| Search | `/api/search` | Full-text search across notes |
| Secrets | `/api/secrets` | CRUD for encrypted secrets, reveal endpoint |
| Database health | `/api/database` | Internal health check used by Docker |

All protected endpoints require an `Authorization: Bearer <token>` header.

---

## Environment Variables

Copy `.env.example` to `.env` and populate the values before starting the stack.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | — | Base64-encoded 32-byte key used to sign JWT tokens. Generate with `make keygen`. |
| `MASTER_KEY` | Yes | — | Base64-encoded 32-byte key used for AES-256-GCM secret encryption. Generate with `make keygen`. |
| `DB_PASSWORD` | Yes | — | Password for the `notevault` PostgreSQL user. |
| `DATABASE_URL` | No | set by compose | Full async SQLAlchemy connection string. Overridden automatically by Docker Compose. |
| `REDIS_URL` | No | `redis://redis:6379/0` | Redis connection URL. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated list of allowed CORS origins. |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Public URL of the backend, used by the Next.js frontend. |
| `DEBUG` | No | `false` | Enable FastAPI debug mode and Swagger UI. Do not set to `true` in production. |
| `ACCESS_TOKEN_EXPIRE_DAYS` | No | `7` | JWT token lifetime in days. |

---

## License

This project is released under the [MIT License](LICENSE).

---

*Built with FastAPI, Next.js, PostgreSQL, and Redis.*
