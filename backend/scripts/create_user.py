#!/usr/bin/env python3
"""
Management script: create a NoteVault user directly in the database.

Usage (interactive):
    docker compose exec -it backend python scripts/create_user.py

Usage (non-interactive):
    docker compose exec backend python scripts/create_user.py USERNAME EMAIL PASSWORD
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


async def run(username: str, email: str, password: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        result = await session.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            print(f"Error: username '{username}' is already taken.")
            sys.exit(1)

        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"Error: email '{email}' is already registered.")
            sys.exit(1)

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
        )
        session.add(user)
        await session.commit()
        print(f"✓ User '{username}' ({email}) created successfully.")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) == 4:
        _username, _email, _password = sys.argv[1], sys.argv[2], sys.argv[3]
    else:
        print("--- NoteVault: create user ---")
        _username = input("Username: ").strip()
        _email = input("Email: ").strip()
        _password = getpass("Password (min 8 chars): ")

    if not _username:
        print("Error: username cannot be empty.")
        sys.exit(1)
    if len(_password) < 8:
        print("Error: password must be at least 8 characters.")
        sys.exit(1)

    asyncio.run(run(_username, _email, _password))
