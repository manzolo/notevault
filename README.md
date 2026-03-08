# NoteVault — Self-hosted Knowledge Base with Encrypted Secrets

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![Frontend: Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)
![Database: PostgreSQL 15](https://img.shields.io/badge/Database-PostgreSQL%2015-336791.svg)
![Encryption: AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-critical.svg)
![Docker Hub](https://img.shields.io/badge/Docker%20Hub-manzolo%2Fnotevault-blue.svg)

NoteVault is a **self-hosted, multi-user knowledge base** that combines a Markdown note editor with a fully encrypted secrets vault. Notes are organised with tags, searchable via PostgreSQL full-text search, and can have file attachments and URL bookmarks. All sensitive values are stored encrypted at rest using AES-256-GCM. The entire stack runs in Docker and is managed through a single `Makefile`.

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
- [Production Deploy](#production-deploy)
- [License](#license)

---

## Features

- **Multi-user with JWT authentication** — each user has an isolated workspace; tokens use HS256 and expire after 7 days.
- **Markdown note editor with live preview** — write in Markdown and see a rendered preview side by side in real time.
- **Tags** — organise notes freely with colour-coded tags; tags are also assignable to attachments and bookmarks.
- **Full-text search with pagination** — powered by PostgreSQL `tsvector` columns and a `GIN` index; searches across note titles, content, attachment text, attachment descriptions, bookmark titles, URLs, and descriptions. Results are paginated.
- **File attachments** — upload files to notes (PDF, images, text, Markdown, …); text is extracted automatically for full-text search. Each attachment can have an optional description and tags.
- **URL bookmarks** — attach bookmarked URLs with title, description, and tags to any note; bookmarks are fully searchable.
- **Encrypted secrets vault** — store API keys, passwords, and other sensitive values encrypted with AES-256-GCM using a `MASTER_KEY` that never touches the database.
- **Per-user rate-limited secret reveal** — secrets are revealed on demand and auto-hidden after 30 seconds; the reveal endpoint is rate-limited via Redis to prevent brute-force access.
- **Audit logging** — every create, update, delete, and reveal action is logged with timestamps and user context; secret values are always redacted from audit records.
- **Dark mode** — full dark mode support across all pages and components.
- **Internationalisation (English + Italian)** — the frontend ships with full `en` and `it` translations; locale is determined by the URL prefix (`/en/...`, `/it/...`).
- **Docker-based deployment** — the stack (PostgreSQL, Redis, backend, frontend) is managed entirely through Docker Compose and a `Makefile`.

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
make build
make up

# 5. Run database migrations
make migrate

# 6. Open the application
# http://localhost:3000
```

> **Note:** On first run, `make build` compiles the backend and frontend images. This may take a few minutes. Subsequent builds use Docker's layer cache.

---

## Make Targets

All day-to-day operations are available as Make targets. Run `make help` to see the full list.

### Development

| Target | Description |
|---|---|
| `build` | (Re)build images for **development** (`NEXT_PUBLIC_API_URL=http://localhost:8000`) |
| `up` | Start all services in detached mode |
| `down` | Stop and remove containers |
| `restart` | Restart all services |
| `migrate` | Apply all pending Alembic migrations |
| `migrate-down` | Roll back the most recent Alembic migration |
| `test` | Run the full test suite (backend + frontend) |
| `test-backend` | Run backend pytest suite |
| `test-frontend` | Run frontend Jest/React test suite in CI mode |
| `test-e2e` | Run Playwright end-to-end tests (requires running stack) |
| `logs` | Follow logs for all services |
| `logs-backend` | Follow logs for the backend service only |
| `shell-backend` | Open a bash shell inside the backend container |
| `shell-db` | Open a psql session inside the database container |
| `keygen` | Generate `SECRET_KEY` and `MASTER_KEY` values |
| `clean` | Remove containers, volumes, and orphaned services |

### Release & Deployment (Docker Hub)

| Target | Description |
|---|---|
| `build-prod` | Build images for **production** (reads `NEXT_PUBLIC_API_URL` from `.env.deploy`) |
| `tag` | Git-tag the commit as `vX.Y.Z` and tag Docker images — `make tag APP_VERSION=1.2.3` |
| `publish` | Push tagged images to Docker Hub and push the git tag — `make publish APP_VERSION=1.2.3` |
| `deploy` | **First-time deploy**: copy compose file + `.env` to server, pull images, start, migrate |
| `deploy-update` | **Rolling update**: pull new image version and restart — `make deploy-update APP_VERSION=1.2.3` |

> Deploy variables (`DEPLOY_HOST`, `DEPLOY_PATH`, `NEXT_PUBLIC_API_URL`) are loaded from `.env.deploy` (gitignored). See [Production Deploy](#production-deploy).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (via reverse proxy)
┌───────────────────────────▼─────────────────────────────┐
│          Frontend  ·  Next.js 14  ·  :3000              │
│          App Router · TypeScript · Tailwind CSS         │
│          next-intl (en / it) · /api/* rewrite → backend │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API (internal)
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

In production, a reverse proxy (e.g. Nginx Proxy Manager) sits in front of the frontend container. The frontend's Next.js server proxies all `/api/*` requests internally to the backend — the backend is never exposed publicly.

---

## Security

- **Keys never logged** — `SECRET_KEY` and `MASTER_KEY` are read from environment variables and are never written to application logs or the database.
- **Secrets encrypted at rest** — every secret value is encrypted with AES-256-GCM before being persisted. The `MASTER_KEY` is the sole encryption root; losing it means losing access to all secrets.
- **Secret values redacted in audit logs** — the audit log records events and secret names, but values are always replaced with `[REDACTED]`.
- **Rate limiting on the reveal endpoint** — Redis enforces a per-user rate limit on `POST /api/secrets/{id}/reveal`.
- **Auto-hide after 30 seconds** — once a secret is revealed in the UI, a client-side timer hides the plaintext automatically.
- **bcrypt 12 rounds** — user passwords are hashed with bcrypt at a cost factor of 12.
- **CORS** — the backend accepts requests only from origins listed in `CORS_ORIGINS`.
- **Deploy secrets stay local** — server-specific configuration (`DEPLOY_HOST`, `DEPLOY_PATH`, `NEXT_PUBLIC_API_URL`) lives in `.env.deploy` which is gitignored and never committed.

> **Key rotation:** To rotate `MASTER_KEY`, decrypt all secrets with the old key, re-encrypt with the new key, and update `.env` before restarting. There is no automated rotation tool in the current release.

---

## Internationalisation

NoteVault uses [next-intl](https://next-intl-docs.vercel.app/) with `localePrefix: 'always'`. Every page URL includes the locale as the first path segment.

| Locale | URL prefix | Translation file |
|---|---|---|
| English | `/en/...` | `frontend/messages/en.json` |
| Italian | `/it/...` | `frontend/messages/it.json` |

The default locale is `en`. Visiting `/` redirects to `/en/`.

---

## API Overview

The REST API is served by FastAPI at `http://localhost:8000`. Interactive documentation is available at `/docs` (Swagger UI) when `DEBUG=true`.

| Endpoint group | Base path | Description |
|---|---|---|
| Authentication | `/api/auth` | Register, login, token refresh |
| Notes | `/api/notes` | CRUD for notes with pagination |
| Tags | `/api/tags` | Create, list, assign tags |
| Search | `/api/search` | Full-text search with pagination |
| Attachments | `/api/notes/{id}/attachments` | Upload, list, stream, delete file attachments |
| Bookmarks | `/api/notes/{id}/bookmarks` | CRUD for URL bookmarks |
| Secrets | `/api/secrets` | CRUD for encrypted secrets, reveal endpoint |
| Database health | `/api/database` | Internal health check |

All protected endpoints require an `Authorization: Bearer <token>` header.

---

## Environment Variables

### Application (`.env`)

Copy `.env.example` to `.env` and populate before starting the stack.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | **yes** | — | Base64-encoded 32-byte key for JWT signing. Generate with `make keygen`. |
| `MASTER_KEY` | **yes** | — | Base64-encoded 32-byte key for AES-256-GCM secret encryption. Generate with `make keygen`. |
| `DB_PASSWORD` | **yes** | — | Password for the `notevault` PostgreSQL user. |
| `DATABASE_URL` | no | set by compose | Full async SQLAlchemy connection string. Set automatically by Docker Compose. |
| `REDIS_URL` | no | `redis://redis:6379/0` | Redis connection URL. |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allowed CORS origins. In production set to your public domain. |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:8000` | **Baked into the frontend bundle at build time.** In production, set to your public domain (e.g. `http://notevault.lan`) via `.env.deploy` and use `make build-prod`. |
| `DEBUG` | no | `false` | Enable FastAPI debug mode and Swagger UI. Must be `false` in production. |

### Deploy configuration (`.env.deploy`, gitignored)

Copy `.env.deploy.example` to `.env.deploy` and fill in your server details. This file is **never committed** to git.

| Variable | Description |
|---|---|
| `DEPLOY_HOST` | SSH target, e.g. `root@your-server.lan` |
| `DEPLOY_PATH` | Absolute path on the remote host, e.g. `/root/notevault` |
| `NEXT_PUBLIC_API_URL` | Public URL of the app (embedded at build time), e.g. `http://notevault.lan` |

### Frontend build variable (baked at build time)

| Variable | Default in Dockerfile | Description |
|---|---|---|
| `BACKEND_INTERNAL_URL` | `http://notevault-backend:8000` | Internal URL used by the Next.js server to proxy `/api/*` requests to the backend. Default is correct for both dev and production Docker deployments. |

---

## Production Deploy

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full guide. Quick summary:

```bash
# 1. Create .env.deploy with your server info (gitignored)
cp .env.deploy.example .env.deploy
# Edit: DEPLOY_HOST, DEPLOY_PATH, NEXT_PUBLIC_API_URL

# 2. Create production .env on your server (copy from .env.prod.example)
#    Set strong DB_PASSWORD, SECRET_KEY, MASTER_KEY, CORS_ORIGINS

# 3. Build, tag, publish to Docker Hub
make build-prod
make tag APP_VERSION=1.0.0
make publish APP_VERSION=1.0.0

# 4. First-time deploy (copies compose + .env, pulls images, starts, migrates)
make deploy

# 5. Future releases
make build-prod && make tag APP_VERSION=1.1.0 && make publish APP_VERSION=1.1.0
make deploy-update APP_VERSION=1.1.0
```

---

## License

This project is released under the [MIT License](LICENSE).

---

*Built with FastAPI, Next.js, PostgreSQL, and Redis.*
