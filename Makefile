.PHONY: up down restart build migrate migrate-down test test-backend test-frontend \
        test-e2e logs logs-backend shell-backend shell-db keygen \
        tag publish deploy deploy-update clean help

# ---------------------------------------------------------------------------
# NoteVault – Makefile
# ---------------------------------------------------------------------------
# Default target
.DEFAULT_GOAL := help

# Docker Hub
DOCKER_USER ?= manzolo
APP_VERSION ?= 0.1.0

# Deployment — override via .env.deploy (gitignored) or env vars
DEPLOY_HOST ?= user@your-server.com
DEPLOY_PATH ?= /opt/notevault
NEXT_PUBLIC_API_URL ?= http://localhost:8000

# Load local deploy overrides if present (gitignored)
-include .env.deploy

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

## build: (Re)build service images (dev — NEXT_PUBLIC_API_URL=http://localhost:8000)
build:
	docker compose build

## build-prod: Build images for production release (reads NEXT_PUBLIC_API_URL from .env.deploy)
##             Usage: make build-prod  (then make tag + make publish)
build-prod:
	NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) docker compose build

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
# Release / Docker Hub
# ---------------------------------------------------------------------------

## tag: Git-tag the current commit as vX.Y.Z and tag local Docker images
##      Usage: make tag APP_VERSION=0.1.0
tag:
	git tag -a v$(APP_VERSION) -m "Release v$(APP_VERSION)"
	docker tag notevault-backend $(DOCKER_USER)/notevault-backend:$(APP_VERSION)
	docker tag notevault-backend $(DOCKER_USER)/notevault-backend:latest
	docker tag notevault-frontend $(DOCKER_USER)/notevault-frontend:$(APP_VERSION)
	docker tag notevault-frontend $(DOCKER_USER)/notevault-frontend:latest
	@echo "Tagged v$(APP_VERSION). Run 'make publish' to push to Docker Hub."

## publish: Push backend + frontend images to Docker Hub
##          Usage: make publish APP_VERSION=0.1.0
publish:
	docker push $(DOCKER_USER)/notevault-backend:$(APP_VERSION)
	docker push $(DOCKER_USER)/notevault-backend:latest
	docker push $(DOCKER_USER)/notevault-frontend:$(APP_VERSION)
	docker push $(DOCKER_USER)/notevault-frontend:latest
	git push origin v$(APP_VERSION)
	@echo "Published $(DOCKER_USER)/notevault-*:$(APP_VERSION) to Docker Hub."

# ---------------------------------------------------------------------------
# Deployment
# ---------------------------------------------------------------------------

## deploy: First-time deploy — copy prod compose + .env, pull images, start stack
##         Requires .env with APP_VERSION, DB_PASSWORD, SECRET_KEY, MASTER_KEY
deploy:
	ssh $(DEPLOY_HOST) "mkdir -p $(DEPLOY_PATH)/data/uploads $(DEPLOY_PATH)/data/postgres $(DEPLOY_PATH)/data/redis"
	scp docker-compose.prod.yml $(DEPLOY_HOST):$(DEPLOY_PATH)/docker-compose.yml
	scp .env $(DEPLOY_HOST):$(DEPLOY_PATH)/.env
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_PATH) && docker compose pull && docker compose up -d && docker compose exec backend alembic upgrade head"
	@echo "Deploy complete. Stack running at http://notevault.lan"

## deploy-update: Pull new images and restart (after publish)
##                Usage: make deploy-update APP_VERSION=0.2.0
deploy-update:
	scp docker-compose.prod.yml $(DEPLOY_HOST):$(DEPLOY_PATH)/docker-compose.yml
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_PATH) && \
		grep -q '^APP_VERSION=' .env \
			&& sed -i 's/^APP_VERSION=.*/APP_VERSION=$(APP_VERSION)/' .env \
			|| echo 'APP_VERSION=$(APP_VERSION)' >> .env && \
		APP_VERSION=$(APP_VERSION) docker compose pull && \
		APP_VERSION=$(APP_VERSION) docker compose up -d && \
		docker compose exec backend alembic upgrade head"
	@echo "Updated to v$(APP_VERSION)."

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
