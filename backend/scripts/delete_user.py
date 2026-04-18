#!/usr/bin/env python3
"""
Management script: delete a NoteVault user (and all their data) from the database.

Usage (interactive):
    docker compose exec -it backend python scripts/delete_user.py

Usage (non-interactive):
    docker compose exec backend python scripts/delete_user.py USERNAME --confirm
"""

import asyncio
import sys

sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import get_settings
from app.models.database import User


async def run(username: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        result = await session.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user:
            print(f"Error: user '{username}' not found.")
            sys.exit(1)

        await session.delete(user)
        await session.commit()
        print(f"✓ User '{username}' ({user.email}) deleted successfully.")

    await engine.dispose()


if __name__ == "__main__":
    confirmed = "--confirm" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--confirm"]

    if args:
        _username = args[0]
    else:
        print("--- NoteVault: delete user ---")
        _username = input("Username to delete: ").strip()

    if not _username:
        print("Error: username cannot be empty.")
        sys.exit(1)

    if not confirmed:
        answer = input(f"Delete user '{_username}' and ALL their data? This cannot be undone. [yes/N]: ").strip()
        if answer.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    asyncio.run(run(_username))
