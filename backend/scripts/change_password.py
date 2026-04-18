#!/usr/bin/env python3
"""
Management script: change a NoteVault user's password directly in the database.

Usage (interactive):
    docker compose exec -it backend python scripts/change_password.py

Usage (non-interactive):
    docker compose exec backend python scripts/change_password.py USERNAME PASSWORD
"""

import asyncio
import sys
from getpass import getpass

sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import get_settings
from app.models.database import User
from app.security.auth import hash_password


async def run(username: str, password: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        result = await session.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user:
            print(f"Error: user '{username}' not found.")
            sys.exit(1)

        user.hashed_password = hash_password(password)
        await session.commit()
        print(f"✓ Password for '{username}' changed successfully.")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) == 3:
        _username, _password = sys.argv[1], sys.argv[2]
    else:
        print("--- NoteVault: change password ---")
        _username = input("Username: ").strip()
        _password = getpass("New password (min 8 chars): ")

    if not _username:
        print("Error: username cannot be empty.")
        sys.exit(1)
    if len(_password) < 8:
        print("Error: password must be at least 8 characters.")
        sys.exit(1)

    asyncio.run(run(_username, _password))
