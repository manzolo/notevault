from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.database import Note, User
from app.security.dependencies import get_current_user


async def get_owned_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note
