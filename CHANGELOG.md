# Changelog

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

