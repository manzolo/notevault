import os
import shutil
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Note, Tag, NoteTag, Attachment
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse, NoteListResponse
from app.security.dependencies import get_current_user
from app.models.database import User
from app.config import get_settings

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=NoteListResponse)
async def list_notes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tag_id: Optional[int] = Query(None),
    created_after: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    updated_after: Optional[datetime] = Query(None),
    updated_before: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    base_filter = Note.user_id == current_user.id

    if tag_id is not None:
        tag_subq = (
            select(NoteTag.note_id)
            .where(NoteTag.tag_id == tag_id)
            .scalar_subquery()
        )
        base_filter = base_filter & Note.id.in_(tag_subq)

    if created_after is not None:
        base_filter = base_filter & (Note.created_at >= created_after)
    if created_before is not None:
        base_filter = base_filter & (Note.created_at <= created_before)
    if updated_after is not None:
        base_filter = base_filter & (Note.updated_at >= updated_after)
    if updated_before is not None:
        base_filter = base_filter & (Note.updated_at <= updated_before)

    count_result = await db.execute(select(func.count(Note.id)).where(base_filter))
    total = count_result.scalar()
    result = await db.execute(
        select(Note).options(selectinload(Note.tags)).where(base_filter)
        .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
        .offset(offset).limit(per_page)
    )
    notes = result.scalars().all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1
    return NoteListResponse(items=list(notes), total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = Note(
        title=note_data.title,
        content=note_data.content,
        is_pinned=note_data.is_pinned,
        user_id=current_user.id,
        category_id=note_data.category_id,
    )
    db.add(note)
    await db.flush()

    # Add tags
    if note_data.tag_ids:
        for tag_id in note_data.tag_ids:
            tag_result = await db.execute(
                select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
            )
            tag = tag_result.scalar_one_or_none()
            if tag:
                note_tag = NoteTag(note_id=note.id, tag_id=tag_id)
                db.add(note_tag)

    await db.flush()
    await db.refresh(note)
    result = await db.execute(
        select(Note).options(selectinload(Note.tags)).where(Note.id == note.id)
    )
    return result.scalar_one()


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if note_data.title is not None:
        note.title = note_data.title
    if note_data.content is not None:
        note.content = note_data.content
    if note_data.is_pinned is not None:
        note.is_pinned = note_data.is_pinned
    if note_data.category_id is not None:
        note.category_id = note_data.category_id

    if note_data.tag_ids is not None:
        # Remove existing tags
        await db.execute(
            NoteTag.__table__.delete().where(NoteTag.note_id == note_id)
        )
        # Add new tags
        for tag_id in note_data.tag_ids:
            tag_result = await db.execute(
                select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
            )
            if tag_result.scalar_one_or_none():
                db.add(NoteTag(note_id=note.id, tag_id=tag_id))

    await db.flush()
    result = await db.execute(
        select(Note).options(selectinload(Note.tags)).where(Note.id == note_id)
    )
    return result.scalar_one()


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    # Delete attachment files from disk before removing the DB record
    settings = get_settings()
    att_result = await db.execute(
        select(Attachment).where(Attachment.note_id == note_id)
    )
    attachments = att_result.scalars().all()
    for att in attachments:
        upload_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
        full_path = os.path.join(upload_dir, att.stored_filename)
        try:
            os.remove(full_path)
        except FileNotFoundError:
            pass
    # Remove the per-note upload directory if empty
    note_upload_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
    try:
        shutil.rmtree(note_upload_dir, ignore_errors=True)
    except Exception:
        pass

    await db.delete(note)
