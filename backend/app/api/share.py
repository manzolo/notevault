import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Note, ShareToken, Tag
from app.schemas.note import NoteResponse
from app.security.dependencies import get_current_user
from app.models.database import User
from app.security.rate_limit import limiter

router = APIRouter(tags=["share"])


@router.post("/api/notes/{note_id}/share", status_code=201)
async def create_share_token(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Check if a share token already exists
    existing = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id)
    )
    existing_token = existing.scalar_one_or_none()
    if existing_token:
        return {"token": existing_token.token}

    token = secrets.token_urlsafe(32)
    share = ShareToken(note_id=note_id, user_id=current_user.id, token=token)
    db.add(share)
    await db.commit()
    return {"token": token}


@router.delete("/api/notes/{note_id}/share", status_code=204)
async def delete_share_token(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id, ShareToken.user_id == current_user.id)
    )
    share = result.scalar_one_or_none()
    if share:
        await db.delete(share)
        await db.commit()


@router.get("/api/notes/{note_id}/share")
async def get_share_status(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id)
    )
    share = result.scalar_one_or_none()
    return {"token": share.token if share else None}


@router.get("/api/share/{token}")
@limiter.limit("30/minute")
async def get_shared_note(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    result = await db.execute(
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.id == share.note_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tags": [{"id": t.id, "name": t.name} for t in note.tags],
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }
