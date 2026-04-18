# Changelog

## [0.13.9] - 2026-04-18
### Fixed
- CI: added `REGISTRATION_ENABLED=true` to both backend and e2e jobs in the GitHub Actions workflow — `conftest.py` registers a test user and was getting 403 because `REGISTRATION_ENABLED` defaults to `false`
- Rate limiter IP fallback now reads `X-Forwarded-For` so per-IP limits work correctly behind Nginx Proxy Manager or any reverse proxy

## [0.13.8] - 2026-04-18
### Fixed
- `make create-user`, `delete-user`, `change-password`: use `$(origin VAR)` instead of `[ -n "$(VAR)" ]` to detect command-line arguments; prevents collision with the `$USERNAME` shell environment variable (always set to the current system user on Linux)

## [0.13.7] - 2026-04-18
### Added
- `make delete-user` command: deletes a user and all their data; interactive with confirmation prompt, or non-interactive via `USERNAME=`
- `make change-password` command: resets a user's password; interactive or non-interactive via `USERNAME= PASSWORD=`
- `docs/DEPLOYMENT.md` §4.6: User Management section with command table, non-interactive examples, and production SSH instructions
- New env vars `CORS_ALLOWED_METHODS`, `CORS_ALLOWED_HEADERS`, `REGISTRATION_ENABLED` documented in all READMEs and DEPLOYMENT.md

## [0.13.6] - 2026-04-18
### Added
- `make create-user` command: creates a NoteVault user directly in the DB, supports interactive and non-interactive (`USERNAME= EMAIL= PASSWORD=`) modes
- `REGISTRATION_ENABLED` setting (default `false`): backend returns 403 when disabled; frontend hides the register link and shows a "disabled" message on the register page
- Security headers middleware: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security` (HTTPS only)
- `CORS_ALLOWED_METHODS` and `CORS_ALLOWED_HEADERS` env vars to restrict CORS beyond just origins
- Startup check: backend refuses to start if `SECRET_KEY` or `MASTER_KEY` is set to the default `changeme`
- README (EN + IT): User Management section, all new env vars documented

### Changed
- Rate-limit login (10/min per IP), register (5/hr per IP), and TOTP verify (5/min per IP)
- `UserCreate` schema now enforces `password` min length of 8 characters
- CORS `allow_methods` and `allow_headers` restricted from `["*"]` to sensible defaults

## [0.13.5] - 2026-04-18
### Fixed
- Attachment list on mobile: filename no longer breaks letter-by-letter; action buttons move below the filename on small screens

## [0.13.4] - 2026-04-18
### Fixed
- Removed redundant "Pinned" badge from NoteCard title row — the pin button on the right already turns violet when a note is pinned

## [0.13.3] - 2026-04-18
### Fixed
- "Include subfolders" toggle in the filters panel now uses the same CSS pill switch as the folder tree sidebar (was inconsistently a plain checkbox)

## [0.13.2] - 2026-04-18
### Fixed
- `pytest-asyncio` bumped from 0.23.3 → 0.23.8 to fix CI INTERNALERROR with `pytest 8.3.5` (`'Package' object has no attribute 'obj'`)

### Changed
- README.md and README.it.md updated: PostgreSQL 17, Node 22, Python 3.12 badges; new sections for Bookmarks, Technical Fields, Notifications; Tasks → Tasks & Reminders; Calendar: recurrence and reminders; architecture diagram and API table updated
- Updated dashboard and calendar screenshots

## [0.13.1] - 2026-04-18
### Changed
- Python upgraded from 3.11 to 3.12 in backend Docker image
- JWT library replaced: `python-jose` (abandoned) → `PyJWT==2.9.0`
- `datetime.utcnow()` replaced with `datetime.now(timezone.utc)` (deprecated in Python 3.12)

## [0.13.0] - 2026-04-18
### Changed
- **PostgreSQL upgraded from 15 to 17** — requires manual data migration (see below)
- Node.js upgraded from 20 to 22 LTS in frontend Docker image
- Backend: FastAPI 0.115.12, SQLAlchemy 2.0.41, Pydantic 2.11.3, cryptography 44.0.3, alembic 1.15.2, bcrypt 4.3.0, uvicorn 0.34.0, redis 5.3.0, httpx 0.28.1, pytest 8.3.5

### Migration guide — PostgreSQL 15 → 17

PostgreSQL major version upgrades require a dump/restore because the data directory format is incompatible. Run these steps **before** updating the stack:

```bash
# 1. Dump the current database (while pg15 is still running)
docker compose exec db pg_dumpall -U notevault > pg_dump_pre_upgrade.sql
wc -l pg_dump_pre_upgrade.sql   # must not be empty

# 2. Stop all containers
docker compose down

# 3. Back up the old data directory (keep it until verified)
mv data/postgres data/postgres_pg15_bak

# 4. Pull the new postgres:17-alpine image
docker compose pull db

# 5. Start only the database (pg17 will initialise a fresh cluster)
docker compose up -d db
sleep 6
docker compose exec db pg_isready -U notevault

# 6. Restore the dump
docker compose exec -T db psql -U notevault postgres < pg_dump_pre_upgrade.sql
# "role/database already exists" errors are normal — ignore them

# 7. Start the full stack
docker compose up -d

# 8. Verify data integrity
docker compose exec db psql -U notevault -c "SELECT count(*) FROM notes;"
docker compose exec db psql -U notevault -c "SELECT version();" | grep PostgreSQL

# 9. Once verified, remove the old backup
# rm -rf data/postgres_pg15_bak
```

## [0.12.9] - 2026-04-18
### Changed
- PostgreSQL upgraded from 15 to 17 (requires data migration — see upgrade notes)
- Node.js upgraded from 20 to 22 LTS in frontend Docker image
- Backend: FastAPI 0.115.12, SQLAlchemy 2.0.41, Pydantic 2.11.3, cryptography 44.0.3, alembic 1.15.2, bcrypt 4.3.0, uvicorn 0.34.0, redis 5.3.0, httpx 0.28.1, pytest 8.3.5

## [0.12.8] - 2026-04-18
### Fixed
- NoteFieldsPanel now starts collapsed when a note has no technical fields, and auto-expands after fetch when fields exist

## [0.12.7] - 2026-04-18
### Added
- Content badge icons on NoteCards (attachments, tasks, events, secrets) with count and tooltip
- Backend batch COUNT queries on `GET /api/notes` for per-note entity counts

### Changed
- Archived sections redesigned to centered divider style across all panels (tasks, events, bookmarks, secrets, attachments)
- Past events section redesigned with same centered divider style
- NoteFieldsPanel (technical fields) moved after Events in note detail page
- `archivedCount` label no longer uses parentheses (e.g. "Archived · 3")

### Fixed
- Race condition: archived count panels no longer flash hidden on mount when all items are archived
- Panels with only archived items now correctly show as expanded instead of collapsed

## [0.12.6] - 2026-04-18
### Fixed
- Replace raw checkbox with animated pill toggle switch for "Include subfolders" option in folder tree

## [0.12.5] - 2026-04-18
### Changed
- Updated bump release command with improved workflow

