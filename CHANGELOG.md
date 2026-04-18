# Changelog

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

