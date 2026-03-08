import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
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
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""

_FTS_TRIGGER = """
CREATE OR REPLACE TRIGGER notes_fts_update
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION notes_fts_trigger_func()
"""


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create schema once per test session — shared across all tests."""
    eng = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(_FTS_FUNCTION))
        await conn.execute(text(_FTS_TRIGGER))
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(engine):
    """Truncate all tables before every test for full isolation."""
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(
                text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE')
            )
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
