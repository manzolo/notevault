import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.database.connection import Base, get_db
from app.config import get_settings

settings = get_settings()

TEST_DATABASE_URL = settings.test_database_url


@pytest_asyncio.fixture
async def test_engine():
    from sqlalchemy import text
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Install FTS trigger (normally done by Alembic migration)
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION notes_fts_trigger_func()
            RETURNS trigger AS $$
            BEGIN
                NEW.fts_vector :=
                    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql
        """))
        await conn.execute(text("""
            CREATE OR REPLACE TRIGGER notes_fts_update
            BEFORE INSERT OR UPDATE ON notes
            FOR EACH ROW EXECUTE FUNCTION notes_fts_trigger_func()
        """))
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    TestSessionLocal = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register a test user and return its auth headers."""
    response = await client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_auth_headers(client):
    """Register a second test user and return its auth headers."""
    response = await client.post("/api/auth/register", json={
        "username": "otheruser",
        "email": "other@example.com",
        "password": "otherpassword123",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
