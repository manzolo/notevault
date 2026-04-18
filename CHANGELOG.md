# Changelog

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

