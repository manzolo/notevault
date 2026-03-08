import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.middleware.logging import AuditLoggingMiddleware
from app.security.rate_limit import limiter
from app.api import auth, notes, tags, categories, secrets, search

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="NoteVault API",
    description="Self-hosted multi-user knowledge base with encrypted secrets management",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "notevault"}
