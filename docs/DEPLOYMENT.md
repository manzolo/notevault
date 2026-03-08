# NoteVault – Deployment Guide

**Version:** 2.0
**Date:** 2026-03-08

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Local Dev)](#2-quick-start-local-dev)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Production Deployment (Docker Hub)](#4-production-deployment-docker-hub)
   - 4.1 [Overview](#41-overview)
   - 4.2 [One-time setup: `.env.deploy`](#42-one-time-setup-envdeploy)
   - 4.3 [Build and publish images](#43-build-and-publish-images)
   - 4.4 [First deploy to the server](#44-first-deploy-to-the-server)
   - 4.5 [Rolling updates](#45-rolling-updates)
5. [Reverse Proxy: Nginx Proxy Manager](#5-reverse-proxy-nginx-proxy-manager)
6. [API Routing Architecture](#6-api-routing-architecture)
7. [Backup Strategy](#7-backup-strategy)
8. [Upgrading](#8-upgrading)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### Local Development

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Docker Engine | 24.0 | Community Edition is sufficient |
| Docker Compose | 2.20 (plugin) | Included with Docker Desktop |
| Python 3 | 3.8+ | Only required for `make keygen` |
| GNU Make | 3.81 | Pre-installed on most Linux/macOS systems |
| git | 2.30 | For cloning the repository |

### Production Host

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Docker Engine | 24.0 | |
| Docker Compose | 2.20 | |
| SSH access | — | Public key auth recommended |
| Docker Hub account | — | Images are pulled from Docker Hub |

---

## 2. Quick Start (Local Dev)

```bash
# Clone
git clone https://github.com/manzolo/notevault.git
cd noteVault

# Generate secret keys
make keygen

# Configure environment
cp .env.example .env
# Edit .env: set SECRET_KEY, MASTER_KEY, DB_PASSWORD

# Build and start
make build
make up
make migrate

# Open http://localhost:3000
```

---

## 3. Environment Variables Reference

### Application (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **yes** | — | HMAC key for JWT signing. 32-byte base64 string. Generate with `make keygen`. |
| `MASTER_KEY` | **yes** | — | Root key for AES-256-GCM secret encryption. 32-byte base64. Generate with `make keygen`. |
| `DB_PASSWORD` | **yes** | — | Password for the `notevault` PostgreSQL user. Use a strong random value. |
| `DATABASE_URL` | no | set by compose | Full async DSN. Overridden automatically by Docker Compose. |
| `REDIS_URL` | no | `redis://redis:6379/0` | Redis connection URL. |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allowed CORS origins. In production set to your public domain. |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:8000` | **Baked into the frontend JS bundle at build time.** In production, set to your public app URL via `.env.deploy` (see below) and build with `make build-prod`. |
| `APP_VERSION` | no | `latest` | Docker Hub image tag to pull on the server. Set in `.env` on the production host. |
| `DEBUG` | no | `false` | Enables FastAPI Swagger UI. Must be `false` in production. |

### Deploy configuration (`.env.deploy`, gitignored)

Create this file locally by copying `.env.deploy.example`. It is **gitignored** and never committed — this keeps server-specific information out of the repository.

```bash
cp .env.deploy.example .env.deploy
```

| Variable | Description | Example |
|----------|-------------|---------|
| `DEPLOY_HOST` | SSH target for the production server | `root@your-server.lan` |
| `DEPLOY_PATH` | Absolute path on the remote host | `/root/notevault` |
| `NEXT_PUBLIC_API_URL` | Public URL of the app, embedded at build time | `http://notevault.lan` |

The Makefile loads `.env.deploy` automatically via `-include .env.deploy` at the top.

### Frontend Dockerfile build arg

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_INTERNAL_URL` | `http://notevault-backend:8000` | URL the Next.js **server** uses to proxy `/api/*` requests to the backend internally. The default in the Dockerfile is correct for both dev and production Docker environments. Override only if your backend container has a different name. |

---

## 4. Production Deployment (Docker Hub)

### 4.1 Overview

The production workflow builds images locally, publishes them to Docker Hub (`manzolo/notevault-backend` and `manzolo/notevault-frontend`), then pulls them on the server. The server never needs the source code — only `docker-compose.prod.yml` and `.env`.

```
Local machine                     Docker Hub             Production server
─────────────                     ──────────             ─────────────────
make build-prod   ──build──►  images built
make tag          ──tag──────► git tag v0.1.0
make publish      ──push──────► manzolo/notevault-*:0.1.0   ◄──pull── make deploy
```

### 4.2 One-time setup: `.env.deploy`

```bash
# On your local machine:
cp .env.deploy.example .env.deploy
```

Edit `.env.deploy`:

```dotenv
DEPLOY_HOST=root@your-server.lan
DEPLOY_PATH=/root/notevault
NEXT_PUBLIC_API_URL=http://notevault.lan   # your public app URL
```

This file is gitignored — your server address and domain name stay off GitHub.

### 4.3 Build and publish images

`NEXT_PUBLIC_API_URL` is a `NEXT_PUBLIC_*` variable that Next.js bakes into the JavaScript bundle **at build time**. It must be correct when the image is built, not when it is deployed.

```bash
# Build with the production URL from .env.deploy
make build-prod

# Tag the git commit and Docker images
make tag APP_VERSION=0.1.0

# Push to Docker Hub and push the git tag
make publish APP_VERSION=0.1.0
```

`make publish` pushes both `manzolo/notevault-backend:0.1.0` / `:latest` and the same for frontend, then runs `git push origin v0.1.0`.

### 4.4 First deploy to the server

**Prepare the server** (one time):

```bash
ssh root@your-server.lan "mkdir -p /root/notevault/data/uploads /root/notevault/data/postgres /root/notevault/data/redis"
```

**Create `.env` on the server:**

```bash
scp .env.prod.example root@your-server.lan:/root/notevault/.env
# Then SSH in and edit it:
ssh root@your-server.lan "nano /root/notevault/.env"
```

Minimum required values in the server `.env`:

```dotenv
APP_VERSION=0.1.0
DB_PASSWORD=<strong random password>
SECRET_KEY=<output of make keygen>
MASTER_KEY=<output of make keygen>
CORS_ORIGINS=http://notevault.lan
NEXT_PUBLIC_API_URL=http://notevault.lan
```

**Deploy:**

```bash
make deploy
```

This command:
1. Copies `docker-compose.prod.yml` to the server as `docker-compose.yml`
2. Copies your local `.env` to the server
3. Runs `docker compose pull` on the server
4. Runs `docker compose up -d`
5. Runs `alembic upgrade head` inside the backend container

### 4.5 Rolling updates

After publishing a new version:

```bash
make deploy-update APP_VERSION=0.2.0
```

This updates the compose file on the server, pulls the new image, restarts affected containers, and runs any new migrations.

---

## 5. Reverse Proxy: Nginx Proxy Manager

The production `docker-compose.prod.yml` attaches the `frontend` container to the `nginx-net` Docker network (external), which is the network used by Nginx Proxy Manager. The backend, database, and Redis remain on the internal `notevault_internal` network only — they are not publicly accessible.

**Configure a proxy host in NPM:**

| Field | Value |
|---|---|
| Domain Names | `notevault.lan` (or your domain) |
| Scheme | `http` |
| Forward Hostname / IP | `notevault-frontend` |
| Forward Port | `3000` |
| Block Common Exploits | enabled |

No backend proxy host is needed — the Next.js server handles `/api/*` internally (see [API Routing Architecture](#6-api-routing-architecture)).

> NPM admin UI is typically at `http://your-server:81`.

---

## 6. API Routing Architecture

Understanding how API calls flow in production:

```
Browser → notevault.lan → NPM → notevault-frontend:3000
                                      │
                              Next.js rewrite
                              /api/:path* → http://notevault-backend:8000/api/:path*
                                      │
                              notevault-backend:8000 (internal network only)
```

1. The browser makes API calls to `http://notevault.lan/api/...` (the `NEXT_PUBLIC_API_URL` baked into the build).
2. NPM receives the request and forwards it to `notevault-frontend:3000`.
3. The Next.js server matches the `/api/:path*` rewrite rule (configured in `frontend/next.config.js`) and proxies the request to `http://notevault-backend:8000/api/...` on the internal Docker network.
4. The response flows back through the same chain.

The backend is **never exposed** on a public port or to the `nginx-net` network.

**Key variables involved:**

| Variable | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `.env.deploy` → baked at `make build-prod` | Browser uses this as the base URL for API calls |
| `BACKEND_INTERNAL_URL` | Dockerfile default = `http://notevault-backend:8000` | Next.js server uses this as the rewrite destination |

---

## 7. Backup Strategy

All persistent data lives in `./data/` on the server:

| Path | Contents |
|---|---|
| `./data/postgres/` | PostgreSQL data directory |
| `./data/uploads/` | Uploaded attachments (per user/note) |
| `./data/redis/` | Redis snapshots (ephemeral, not critical) |

**Manual database backup:**

```bash
ssh root@your-server.lan "cd /root/notevault && docker compose exec -T db pg_dump -U notevault notevault | gzip > /root/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
```

**Restore:**

```bash
# Stop backend to prevent writes
docker compose stop backend

# Drop and recreate database
docker compose exec db psql -U notevault -c "DROP DATABASE IF EXISTS notevault;"
docker compose exec db psql -U notevault -c "CREATE DATABASE notevault;"

# Restore
gunzip -c backup_20260308_020000.sql.gz | docker compose exec -T db psql -U notevault notevault

# Restart and re-migrate
docker compose start backend
docker compose exec backend alembic upgrade head
```

**Attachment backup** — the `./data/uploads/` directory should be included in your backup strategy alongside the database dump, since attachment files are referenced by path in the database.

---

## 8. Upgrading

### Standard release upgrade

```bash
# On your local machine:

# 1. Make your code changes, run tests
make test-backend

# 2. Build production images (reads NEXT_PUBLIC_API_URL from .env.deploy)
make build-prod

# 3. Tag and publish to Docker Hub
make tag APP_VERSION=0.2.0
make publish APP_VERSION=0.2.0

# 4. Update the server (pulls new image, restarts, migrates)
make deploy-update APP_VERSION=0.2.0
```

### Update server .env only (no image rebuild)

If you only need to change server configuration (e.g. rotate a key):

```bash
scp .env root@your-server.lan:/root/notevault/.env
ssh root@your-server.lan "cd /root/notevault && docker compose up -d"
```

---

## 9. Troubleshooting

### Services fail to start

```bash
ssh root@your-server.lan "cd /root/notevault && docker compose logs"
```

Common causes:
- `SECRET_KEY` or `MASTER_KEY` not set or invalid base64.
- `DB_PASSWORD` missing.
- `nginx-net` Docker network does not exist (run `docker network create nginx-net` or ensure Nginx Proxy Manager is running).

### API calls return network error in browser

The `NEXT_PUBLIC_API_URL` embedded in the frontend image does not match your server's domain, or NPM is not configured to proxy `notevault.lan` → `notevault-frontend:3000`.

Check that:
1. `NEXT_PUBLIC_API_URL` in `.env.deploy` matches the domain you browse to.
2. `make build-prod` was run **after** setting `.env.deploy` (the URL is baked at build time).
3. NPM has a proxy host for your domain pointing to `notevault-frontend:3000`.

### Migrations fail

```bash
ssh root@your-server.lan "cd /root/notevault && docker compose exec backend alembic current"
ssh root@your-server.lan "cd /root/notevault && docker compose exec backend alembic history"
```

### Secret decryption errors (500 on reveal)

`MASTER_KEY` in `.env` on the server does not match the key used when secrets were created. Do not rotate `MASTER_KEY` without a planned re-encryption procedure.

### Frontend container not reachable by NPM

Verify the frontend container is on `nginx-net`:

```bash
docker network inspect nginx-net | grep notevault-frontend
```

If missing, the `nginx-net` external network in `docker-compose.prod.yml` may not match the actual network name. Check with `docker network ls`.
