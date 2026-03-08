.PHONY: up down restart build migrate migrate-down test test-backend test-frontend \
        test-e2e logs logs-backend shell-backend shell-db keygen deploy clean help

# ---------------------------------------------------------------------------
# NoteVault – Makefile
# ---------------------------------------------------------------------------
# Default target
.DEFAULT_GOAL := help

# Deployment variables (override on the command line or via environment)
DEPLOY_KEY  ?= ~/.ssh/id_rsa
DEPLOY_HOST ?= user@example.com
DEPLOY_PATH ?= /opt/notevault

# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------

## up: Start all services in detached mode
up:
	docker compose up -d

## down: Stop and remove containers
down:
	docker compose down

## restart: Restart all services
restart:
	docker compose restart

## build: (Re)build service images
build:
	docker compose build

# ---------------------------------------------------------------------------
# Database migrations
# ---------------------------------------------------------------------------

## migrate: Apply all pending Alembic migrations
migrate:
	docker compose exec backend alembic upgrade head

## migrate-down: Roll back the most recent Alembic migration
migrate-down:
	docker compose exec backend alembic downgrade -1

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------

## test: Run the full test suite (backend + frontend unit)
test: test-backend test-frontend

## test-backend: Run backend pytest suite (includes full-flow tests with E2eTest123! user)
test-backend:
	docker compose exec backend pytest tests/ -v

## test-frontend: Run frontend Jest/React unit tests (CI mode)
test-frontend:
	docker compose exec frontend npm test -- --watchAll=false

## test-e2e: Run Playwright E2E tests against the running stack (requires: make up)
test-e2e:
	cd frontend && npx playwright test

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

## logs: Follow logs for all services
logs:
	docker compose logs -f

## logs-backend: Follow logs for the backend service only
logs-backend:
	docker compose logs -f backend

# ---------------------------------------------------------------------------
# Shells
# ---------------------------------------------------------------------------

## shell-backend: Open a bash shell inside the backend container
shell-backend:
	docker compose exec backend bash

## shell-db: Open a psql session inside the database container
shell-db:
	docker compose exec db psql -U notevault -d notevault

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

## keygen: Generate SECRET_KEY and MASTER_KEY values for .env
keygen:
	@python3 -c "import secrets,base64; \
		print('SECRET_KEY='  + base64.b64encode(secrets.token_bytes(32)).decode()); \
		print('MASTER_KEY='  + base64.b64encode(secrets.token_bytes(32)).decode())"

# ---------------------------------------------------------------------------
# Deployment
# ---------------------------------------------------------------------------

## deploy: Sync codebase to remote host and restart services
##         Requires: DEPLOY_KEY, DEPLOY_HOST, DEPLOY_PATH
deploy:
	rsync -avz --delete -e "ssh -i $(DEPLOY_KEY)" . $(DEPLOY_HOST):$(DEPLOY_PATH) && \
	ssh -i $(DEPLOY_KEY) $(DEPLOY_HOST) \
		"cd $(DEPLOY_PATH) && docker compose up -d --build"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

## clean: Remove containers, volumes, and orphaned services
clean:
	docker compose down -v --remove-orphans

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

## help: List all available make targets with descriptions
help:
	@echo ""
	@echo "NoteVault – available make targets"
	@echo "==================================="
	@grep -E '^## ' $(MAKEFILE_LIST) | \
		sed 's/^## //' | \
		awk -F': ' '{ printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }'
	@echo ""
