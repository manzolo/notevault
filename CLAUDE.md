# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Infrastructure
```bash
make build          # rebuild Docker images (REQUIRED after any code change before make up)
make up             # start all containers detached
make down           # stop containers
make migrate        # apply pending Alembic migrations inside backend container
make migrate-down   # roll back last migration
make shell-backend  # bash inside backend container
make shell-db       # psql session inside db container
make keygen         # generate SECRET_KEY + MASTER_KEY for .env
```

### Testing
```bash
make test-reset                                  # Full clean → build → up → drop/create test DB → migrate → pytest.
                                                 # USE THIS when in doubt — guarantees a deterministic run.
make test-backend                                # Fast pytest on already-running stack. Fails if backend is not up.
cd frontend && npm test -- --watchAll=false      # Jest unit tests locally
# NOTE: make test-frontend is broken — the prod container has no jest. Run locally.
cd frontend && npx playwright test               # E2E (requires make up first)

# Single backend test:
docker compose exec backend pytest tests/test_api_notes.py::test_list_notes -v
# Single frontend test file:
cd frontend && npm test -- --watchAll=false --testPathPattern=useTags
```

**Deterministic test suite.** If `make test-backend` shows failures, do NOT
conclude "it's test ordering" or "pre-existing failure" — that diagnosis was
wrong in the past. The real causes were: (1) a per-table `TRUNCATE` loop in
`conftest.py` that deadlocked with lingering session locks, and (2) the
slowapi `Limiter` in-memory state keyed by `user:1` (since `RESTART IDENTITY`
resets user IDs) accumulating across tests and eventually returning 429.
Both are fixed in `backend/tests/conftest.py` (atomic TRUNCATE with deadlock
retry + autouse `limiter.reset()` + per-test upload dir). If tests still
flicker, run `make test-reset` — if that also fails, it's a genuine bug.

**Every new feature must ship with its tests.** Definition-of-done for any
non-trivial change: the new tests exist, cover the change, and pass under
`make test-reset`. No more "feature merged, tests added later".

### Release
```bash
make build-prod                         # build with NEXT_PUBLIC_API_URL from .env.deploy
make tag APP_VERSION=X.Y.Z              # git tag + docker tag
make publish APP_VERSION=X.Y.Z         # docker push + git push tag
make deploy-update APP_VERSION=X.Y.Z   # rolling update on production server
```

## Architecture

Four-service Docker Compose stack: `notevault-frontend` (Next.js :3000) → `notevault-backend` (FastAPI :8000) → `notevault-db` (PostgreSQL 15 :5432) + `notevault-redis` (Redis 7 :6379).

In production, browser traffic hits Nginx Proxy Manager → frontend:3000. The frontend rewrites `/api/*` → backend:8000 via `next.config.js` `BACKEND_INTERNAL_URL` (runtime env, defaults to `http://notevault-backend:8000`). `NEXT_PUBLIC_API_URL` is baked at build time for client-side use; it defaults to `''` (empty = same-origin, domain-agnostic). All API call paths are already `/api/...` so no baseURL is needed in same-origin setups.

### Backend (`backend/app/`)

| Path | Purpose |
|------|---------|
| `main.py` | FastAPI app factory, middleware, router registration |
| `config.py` | `Settings` (pydantic-settings); `cors_origins` is a comma-string (not list); `master_key_bytes` SHA-256-hashes any non-32-byte key |
| `models/database.py` | All SQLAlchemy ORM models in one file; `SAEnum` uses `values_callable=lambda x: [e.value for e in x]` |
| `api/` | One router per domain: `auth`, `notes`, `tags`, `categories`, `secrets`, `search`, `attachments`, `bookmarks` |
| `security/auth.py` | JWT HS256 (7-day), bcrypt directly (no passlib) |
| `security/encryption.py` | `SecretEncryption`: stores `nonce(12B) || ciphertext` as BYTEA |
| `security/rate_limit.py` | Single global slowapi `Limiter`; key = `user:{id}` from JWT sub |
| `database/migrations/env.py` | Swaps asyncpg → psycopg2 for Alembic sync ops |

**FTS:** `fts_vector` columns on `notes`, `attachments`, `bookmarks` are populated exclusively by PostgreSQL triggers (never written from the ORM). `conftest.py` must install these triggers explicitly — `Base.metadata.create_all` does not.

**Tags:** M2M via `note_tags`, `attachment_tags`, `bookmark_tags` join tables. Tags are per-user (unique on `name + user_id`). `POST /api/tags` is idempotent (returns existing tag if name exists). Filter notes by tag with `GET /api/notes?tag_id=N` (subquery, no JOIN to avoid duplicates).

**Secrets encryption:** `MASTER_KEY` env var → `master_key_bytes` (32B) → `AESGCM`. Changing `MASTER_KEY` makes all existing secrets unreadable.

### Frontend (`frontend/`)

All pages live under `frontend/app/[locale]/` (next-intl App Router i18n). Locales: `en` (default), `it`. Strings in `messages/{en,it}.json`.

| Path | Purpose |
|------|---------|
| `lib/api.ts` | axios instance with JWT Bearer interceptor; 401 → redirect to login |
| `lib/types.ts` | All TypeScript types (Note, Tag, Secret, Attachment, Bookmark…) |
| `hooks/useNotes.ts` | Fetch paginated notes; accepts optional `tagId` for tag filter |
| `hooks/useTags.ts` | `fetchTags` + `createTag` (alphabetical dedup insert) |
| `hooks/useSecrets.ts` | 30-second auto-clear timer for revealed secret values |
| `components/common/Button.tsx` | variants: `primary` (indigo gradient), `secondary` (gray), `danger`, `ghost`, `ghost-danger` |
| `components/common/Icons.tsx` | Centralised SVG icon library |
| `components/common/ConfirmDialog.tsx` | Async modal, replaces all `window.confirm()` |
| `components/notes/NoteEditor.tsx` | Tag picker + inline tag creation; Save button is `secondary` variant |
| `components/search/TagFilter.tsx` | Horizontal tag filter strip above note list |

**Button variant convention:** action buttons outside forms use `secondary`; destructive icon buttons use `ghost-danger`; the indigo `primary` gradient is reserved for primary form submit actions (login, register).

### Database migrations
Migrations in `backend/app/database/migrations/versions/`. Numbered `00N_description.py`. Run via `make migrate`. Test schema is created from scratch by `conftest.py` (session-scoped engine + `TRUNCATE` before each test, FTS triggers installed explicitly).

### Test setup
- Backend: `pytest.ini` has `asyncio_mode = auto`. `TEST_DATABASE_URL` env var points to `notevault_test` DB. `conftest.py` is session-scoped (schema created once, truncated between tests).
- Frontend: Jest + `@testing-library/react`. Mock `@/lib/api` with `jest.mock`. Use `renderHook` + `act` for hook tests.

## Key env vars

| Var | Notes |
|-----|-------|
| `SECRET_KEY` | JWT signing key (base64, 32B); generate with `make keygen` |
| `MASTER_KEY` | AES-256-GCM master key (base64, 32B); changing it breaks existing secrets |
| `CORS_ORIGINS` | Comma-separated list (e.g. `http://localhost:3000,https://notevault.lan`) |
| `NEXT_PUBLIC_API_URL` | Baked at build time; defaults to `''` (same-origin, domain-agnostic); only set for cross-origin setups |
| `BACKEND_INTERNAL_URL` | Runtime Next.js rewrite target; default `http://notevault-backend:8000` |
