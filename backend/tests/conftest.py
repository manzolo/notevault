import asyncio
import os
import tempfile
import pytest
import pytest_asyncio
from asyncpg.exceptions import DeadlockDetectedError
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.database.connection import Base, get_db
from app.config import get_settings

settings = get_settings()

# Allow override via env var so CI can point at its own PostgreSQL
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", settings.test_database_url)

_FTS_FUNCTION = """
CREATE OR REPLACE FUNCTION notes_fts_trigger_func()
RETURNS trigger AS $$
BEGIN
    NEW.fts_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""

_FTS_TRIGGER = """
CREATE OR REPLACE TRIGGER notes_fts_update
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION notes_fts_trigger_func()
"""

_ATTACHMENT_FTS_FUNCTION = """
CREATE OR REPLACE FUNCTION attachments_fts_trigger_func()
RETURNS trigger AS $$
BEGIN
    NEW.fts_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.filename, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.extracted_text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""

_ATTACHMENT_FTS_TRIGGER = """
CREATE OR REPLACE TRIGGER attachments_fts_update
BEFORE INSERT OR UPDATE ON attachments
FOR EACH ROW EXECUTE FUNCTION attachments_fts_trigger_func()
"""

_BOOKMARK_FTS_FUNCTION = """
CREATE OR REPLACE FUNCTION bookmarks_fts_trigger_func()
RETURNS trigger AS $$
BEGIN
    NEW.fts_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.url, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""

_BOOKMARK_FTS_TRIGGER = """
CREATE OR REPLACE TRIGGER bookmarks_fts_update
BEFORE INSERT OR UPDATE ON bookmarks
FOR EACH ROW EXECUTE FUNCTION bookmarks_fts_trigger_func()
"""


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create schema once per test session — shared across all tests.
    Drops any leftover tables from a previous aborted run first so the session
    always starts from a pristine schema."""
    eng = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(_FTS_FUNCTION))
        await conn.execute(text(_FTS_TRIGGER))
        await conn.execute(text(_ATTACHMENT_FTS_FUNCTION))
        await conn.execute(text(_ATTACHMENT_FTS_TRIGGER))
        await conn.execute(text(_BOOKMARK_FTS_FUNCTION))
        await conn.execute(text(_BOOKMARK_FTS_TRIGGER))
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(engine):
    """Atomic TRUNCATE of all tables before every test for full isolation.
    Uses a single statement so Postgres acquires every lock at once in one
    shot, avoiding the deadlock cycles a per-table loop produced when a
    previous test's session had not fully released its locks yet."""
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    stmt = text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE")
    for attempt in range(3):
        try:
            async with engine.begin() as conn:
                await conn.execute(stmt)
            break
        except DBAPIError as e:
            if isinstance(e.orig, DeadlockDetectedError) and attempt < 2:
                await asyncio.sleep(0.05 * (attempt + 1))
                continue
            raise
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """slowapi Limiter keeps in-memory state keyed by user:{id}. Since test
    user IDs restart from 1 each test (RESTART IDENTITY CASCADE), that state
    leaks across tests and eventually 429s legitimate requests."""
    from app.security.rate_limit import limiter
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def _reset_upload_dir(tmp_path):
    """Per-test upload dir so files from previous tests don't collide with
    identical (user_id, note_id) paths after RESTART IDENTITY."""
    settings.upload_dir = str(tmp_path / "uploads")
    yield


@pytest_asyncio.fixture
async def db_session(engine):
    """Provide a real async DB session connected to the test database."""
    TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """HTTP test client with get_db overridden to use the test session."""

    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register a test user and return Bearer headers."""
    response = await client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest_asyncio.fixture
async def second_auth_headers(client):
    """Register a second user and return Bearer headers."""
    response = await client.post("/api/auth/register", json={
        "username": "otheruser",
        "email": "other@example.com",
        "password": "otherpassword123",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
