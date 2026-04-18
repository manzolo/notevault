import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.middleware.logging import AuditLoggingMiddleware
from app.security.rate_limit import limiter
from app.api import auth, notes, tags, categories, secrets, search, attachments, bookmarks, tasks, share, events, note_fields, field_dates, reminders, notifications, task_reminders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    scheduler = None
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        settings.check_insecure_defaults()
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from app.services.scheduler import check_reminders

        scheduler = AsyncIOScheduler()
        scheduler.add_job(check_reminders, "interval", seconds=60, id="check_reminders")
        scheduler.start()
        logging.getLogger(__name__).info("APScheduler started")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="NoteVault API",
    description="Self-hosted multi-user knowledge base with encrypted secrets management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=settings.cors_allowed_methods_list,
    allow_headers=settings.cors_allowed_headers_list,
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# Audit logging middleware
app.add_middleware(AuditLoggingMiddleware)

# Rate limiter (keyed by user ID from JWT; app.state.limiter is required by slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(categories.router)
app.include_router(secrets.router)
app.include_router(search.router)
app.include_router(attachments.router)
app.include_router(bookmarks.router)
app.include_router(tasks.router)
app.include_router(share.router)
app.include_router(events.router)
app.include_router(note_fields.router)
app.include_router(field_dates.router)
app.include_router(reminders.router)
app.include_router(task_reminders.router)
app.include_router(notifications.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "notevault"}


@app.get("/api/config")
async def public_config():
    """Public endpoint: exposes runtime-configurable limits to the frontend."""
    return {
        "max_upload_bytes": settings.max_upload_bytes,
        "favicon_fetch_enabled": settings.favicon_fetch_enabled,
        "registration_enabled": settings.registration_enabled,
    }
