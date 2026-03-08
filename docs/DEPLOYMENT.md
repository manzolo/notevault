# NoteVault – Deployment Guide

**Version:** 1.0
**Date:** 2026-03-08

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start with Docker](#2-quick-start-with-docker)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Production Deployment](#4-production-deployment)
   - 4.1 [Prepare the Remote Host](#41-prepare-the-remote-host)
   - 4.2 [Deploy with make deploy](#42-deploy-with-make-deploy)
   - 4.3 [First-Run Initialisation](#43-first-run-initialisation)
5. [SSL/TLS Setup](#5-ssltls-setup)
   - 5.1 [Caddy (recommended)](#51-caddy-recommended)
   - 5.2 [nginx + Certbot](#52-nginx--certbot)
6. [Backup Strategy](#6-backup-strategy)
   - 6.1 [Database Backups](#61-database-backups)
   - 6.2 [Restoring a Backup](#62-restoring-a-backup)
   - 6.3 [Backup Retention](#63-backup-retention)
7. [Monitoring](#7-monitoring)
   - 7.1 [Health Check Endpoint](#71-health-check-endpoint)
   - 7.2 [Log Aggregation](#72-log-aggregation)
   - 7.3 [Metrics](#73-metrics)
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
| OS | Ubuntu 22.04 LTS | Debian 12 also tested |
| CPU | 2 vCPU | |
| RAM | 2 GB | 4 GB recommended |
| Disk | 20 GB | For data volume and images |
| Open ports | 80, 443 | For HTTP→HTTPS redirect and TLS |
| SSH access | — | For `make deploy` |

---

## 2. Quick Start with Docker

Follow these steps to run NoteVault locally in under five minutes.

**Step 1: Clone the repository**

```bash
git clone https://github.com/your-org/notevault.git
cd notevault
```

**Step 2: Generate secret keys**

```bash
make keygen
```

This outputs two lines, for example:

```
SECRET_KEY=abc123...
MASTER_KEY=xyz789...
```

**Step 3: Create the environment file**

```bash
cp .env.example .env
```

Open `.env` and paste the values generated in step 2, then review the other settings (see the [Environment Variables Reference](#3-environment-variables-reference)).

**Step 4: Build and start services**

```bash
make build
make up
```

**Step 5: Run database migrations**

```bash
make migrate
```

**Step 6: Open the application**

Navigate to `http://localhost:3000` in your browser. Register a new account to get started.

---

## 3. Environment Variables Reference

Copy `.env.example` to `.env` and set the following variables before starting the stack.

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **yes** | — | HMAC key for JWT signing. 32-byte base64 string. Generate with `make keygen`. |
| `MASTER_KEY` | **yes** | — | Root key material for secret encryption. 32-byte base64 string. Generate with `make keygen`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `60` | JWT access token lifetime in minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | `30` | Refresh token lifetime in days. |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` | Comma-separated list of allowed CORS origins. In production, set to your public domain. |
| `DEBUG` | no | `false` | Enable FastAPI debug mode. **Must be `false` in production.** |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | no | `notevault` | PostgreSQL superuser name. |
| `POSTGRES_PASSWORD` | **yes** | — | PostgreSQL password. Use a strong random value. |
| `POSTGRES_DB` | no | `notevault` | PostgreSQL database name. |
| `DATABASE_URL` | no | Constructed | Full async DSN: `postgresql+asyncpg://user:pass@db:5432/notevault`. If provided, overrides individual `POSTGRES_*` vars. |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | no | `redis://redis:6379/0` | Redis connection URL. |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:8000` | Base URL of the backend API, visible to the browser. In production, set to your public API URL (e.g., `https://api.notevault.example.com`). |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_REVEAL_PER_MINUTE` | no | `10` | Maximum secret reveal operations per user per minute. |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | no | `200` | Global request rate limit per IP address per minute. |

### Example `.env` file

```dotenv
# Application
SECRET_KEY=<output of make keygen>
MASTER_KEY=<output of make keygen>
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
ALLOWED_ORIGINS=https://notevault.example.com
DEBUG=false

# Database
POSTGRES_USER=notevault
POSTGRES_PASSWORD=change_me_to_a_strong_password
POSTGRES_DB=notevault

# Redis
REDIS_URL=redis://redis:6379/0

# Frontend
NEXT_PUBLIC_API_URL=https://api.notevault.example.com
```

---

## 4. Production Deployment

### 4.1 Prepare the Remote Host

**Install Docker on the remote host:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**Create the deployment directory and set permissions:**

```bash
sudo mkdir -p /opt/notevault
sudo chown $USER:$USER /opt/notevault
```

**Set up SSH key access (on your local machine):**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/notevault_deploy -C "notevault deploy key"
ssh-copy-id -i ~/.ssh/notevault_deploy.pub user@your-server.example.com
```

### 4.2 Deploy with make deploy

The `make deploy` target uses `rsync` to synchronise the local codebase to the remote host, then SSH-executes `docker compose up -d --build` to rebuild and restart the stack.

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DEPLOY_KEY` | Path to the SSH private key | `~/.ssh/notevault_deploy` |
| `DEPLOY_HOST` | SSH user and hostname | `deploy@notevault.example.com` |
| `DEPLOY_PATH` | Absolute path on the remote host | `/opt/notevault` |

**Usage:**

```bash
make deploy \
  DEPLOY_KEY=~/.ssh/notevault_deploy \
  DEPLOY_HOST=deploy@notevault.example.com \
  DEPLOY_PATH=/opt/notevault
```

These variables can also be exported in your shell or added to a local `.make.env` file to avoid repeating them.

**What it does:**

1. `rsync -avz --delete` copies all project files to the remote host, deleting any files on the remote that no longer exist locally. Files listed in `.gitignore` and `.rsyncignore` (if present) are excluded.
2. SSH executes `docker compose up -d --build` on the remote host, which rebuilds changed images and restarts updated services with zero manual steps.

> **Note:** Ensure the `.env` file on the remote host is configured before the first deploy. The `.env` file should not be committed to git or transferred via rsync if it contains production secrets; provision it separately on the remote host.

### 4.3 First-Run Initialisation

After the first deployment, run database migrations on the remote host:

```bash
ssh -i ~/.ssh/notevault_deploy deploy@notevault.example.com \
  "cd /opt/notevault && docker compose exec backend alembic upgrade head"
```

Or equivalently from your local machine if you have the Makefile pointing at the remote (advanced setup):

```bash
make migrate
```

---

## 5. SSL/TLS Setup

NoteVault should always be served over HTTPS in production. The Docker Compose stack does not include TLS termination by default; it is the responsibility of a reverse proxy running in front of the stack.

### 5.1 Caddy (recommended)

Caddy handles TLS certificate provisioning and renewal automatically via Let's Encrypt.

Create `/opt/notevault/Caddyfile`:

```caddy
notevault.example.com {
    reverse_proxy frontend:3000
}

api.notevault.example.com {
    reverse_proxy backend:8000
}
```

Add Caddy to `docker-compose.override.yml`:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - notevault-net

volumes:
  caddy_data:
  caddy_config:
```

### 5.2 nginx + Certbot

**Install Certbot and obtain certificates:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d notevault.example.com -d api.notevault.example.com
```

**nginx site configuration** (`/etc/nginx/sites-available/notevault`):

```nginx
server {
    listen 80;
    server_name notevault.example.com api.notevault.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notevault.example.com;

    ssl_certificate     /etc/letsencrypt/live/notevault.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notevault.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name api.notevault.example.com;

    ssl_certificate     /etc/letsencrypt/live/notevault.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notevault.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Certbot configures automatic renewal via a systemd timer. Verify with:

```bash
sudo certbot renew --dry-run
```

---

## 6. Backup Strategy

### 6.1 Database Backups

All persistent application data lives in the PostgreSQL container. Redis holds only ephemeral state and does not require backup.

**Manual backup:**

```bash
docker compose exec db pg_dump -U notevault notevault | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Automated daily backup script** (`/opt/notevault/scripts/backup.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/notevault/backups"
RETAIN_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/notevault_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose -f /opt/notevault/docker-compose.yml exec -T db \
  pg_dump -U notevault notevault | gzip > "$FILE"

echo "Backup written to $FILE"

# Remove backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "notevault_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
echo "Old backups pruned."
```

Make it executable and schedule it with cron:

```bash
chmod +x /opt/notevault/scripts/backup.sh
crontab -e
# Add: 0 2 * * * /opt/notevault/scripts/backup.sh >> /var/log/notevault-backup.log 2>&1
```

**Off-site backup:**

Copy completed backups to a remote storage provider (S3, Backblaze B2, etc.) using `rclone` or `aws s3 cp`:

```bash
aws s3 cp "$FILE" s3://your-backup-bucket/notevault/
```

### 6.2 Restoring a Backup

```bash
# Stop the backend to prevent writes during restore
docker compose stop backend

# Drop and recreate the database
docker compose exec db psql -U notevault -c "DROP DATABASE IF EXISTS notevault;"
docker compose exec db psql -U notevault -c "CREATE DATABASE notevault;"

# Restore
gunzip -c backup_20260308_020000.sql.gz | \
  docker compose exec -T db psql -U notevault notevault

# Restart backend
docker compose start backend

# Verify migrations are current
make migrate
```

### 6.3 Backup Retention

| Backup Type | Frequency | Retain |
|-------------|-----------|--------|
| Daily automated | Every night at 02:00 | 30 days local |
| Weekly off-site | Every Sunday | 12 weeks |
| Pre-deploy snapshot | Before each `make deploy` | 5 most recent |

---

## 7. Monitoring

### 7.1 Health Check Endpoint

The backend exposes a health check endpoint that can be polled by load balancers and uptime monitors:

```
GET https://api.notevault.example.com/health
```

A healthy response returns HTTP 200. A degraded or unhealthy response returns HTTP 503. See the [API Reference](API.md#10-health-endpoint) for the full response schema.

**Example uptime monitor configuration (UptimeRobot / Better Uptime):**

- URL: `https://api.notevault.example.com/health`
- Method: GET
- Expected status: 200
- Interval: 1 minute
- Alert threshold: 2 consecutive failures

### 7.2 Log Aggregation

View live logs with:

```bash
make logs              # all services
make logs-backend      # backend only
docker compose logs -f frontend   # frontend only
docker compose logs -f db         # postgres only
```

**Structured logging (production):**

The backend emits JSON-formatted logs when `DEBUG=false`. These can be forwarded to any log aggregation service using the Docker logging driver.

Example configuration in `docker-compose.override.yml` for forwarding to a Loki instance:

```yaml
services:
  backend:
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-external-labels: "service=notevault-backend,env=production"
```

### 7.3 Metrics

For production deployments with Prometheus, configure a scrape job for the backend:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: notevault
    static_configs:
      - targets: ['api.notevault.example.com']
    metrics_path: /metrics
    scheme: https
```

The `/metrics` endpoint (if enabled via `ENABLE_METRICS=true`) exposes:

- Request counts and latencies by route and status code
- Active database connections
- Redis connection pool utilisation
- Secret reveal operation counts

---

## 8. Upgrading

1. **Review the changelog** for any breaking changes or required migration steps.

2. **Take a pre-upgrade backup:**
   ```bash
   docker compose exec db pg_dump -U notevault notevault | gzip > pre_upgrade_backup.sql.gz
   ```

3. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

4. **Rebuild images and restart:**
   ```bash
   make build
   make up
   ```

5. **Run any new migrations:**
   ```bash
   make migrate
   ```

6. **Verify the health endpoint:**
   ```bash
   curl https://api.notevault.example.com/health
   ```

For remote deployments, steps 3–5 are performed automatically by `make deploy`. However, you should always perform step 2 manually before running `make deploy` on a production instance.

---

## 9. Troubleshooting

### Services fail to start

```bash
docker compose logs
```

Check for misconfigured environment variables. The most common causes are:

- `SECRET_KEY` or `MASTER_KEY` not set or not valid base64.
- `POSTGRES_PASSWORD` missing.
- Port conflicts if 3000 or 8000 is already in use on the host.

### Database connection errors

```bash
make shell-db
```

Verifies that PostgreSQL is reachable from within the Docker network. If this command fails, check that the `db` service is running (`docker compose ps`).

### Migrations fail

```bash
make shell-backend
alembic history
alembic current
```

Inspect the migration state. If the database is ahead of the migration history (e.g., after a botched migration), you may need to stamp the current revision:

```bash
alembic stamp head
```

### Secret decryption errors (500 on reveal)

This indicates that the `MASTER_KEY` in the environment does not match the key used when the secrets were created. Possible causes:

- The `MASTER_KEY` was rotated without a re-encryption migration.
- The `.env` file on the production host differs from the one used during initial setup.

Do not rotate `MASTER_KEY` without a planned re-encryption procedure.

### JWT errors (401 on valid login)

- Verify `SECRET_KEY` has not changed between restarts.
- Verify the system clock on the server is accurate (JWT `exp` validation is time-dependent). Install `chrony` or `ntp` if needed.
- Check Redis connectivity if tokens appear to be incorrectly blacklisted.

### Rate limit always triggered (429)

- Check Redis connectivity: `docker compose logs redis`.
- Verify the `RATE_LIMIT_*` environment variables are set to sensible values.
- In development, you can temporarily raise `RATE_LIMIT_REVEAL_PER_MINUTE` in `.env`.
