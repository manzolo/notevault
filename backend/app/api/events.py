import os
import uuid
import aiofiles
from calendar import monthrange
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.database import Event, EventAttachment, Note, User
from app.schemas.event import EventCreate, EventUpdate, EventResponse, EventWithNoteResponse, EventAttachmentResponse
from app.security.dependencies import get_current_user

router = APIRouter(tags=["events"])

UPLOAD_BASE = "/app/data/uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


async def _get_note_owned(note_id: int, user: User, db: AsyncSession) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


async def _get_event_owned(event_id: int, user: User, db: AsyncSession) -> Event:
    result = await db.execute(
        select(Event)
        .options(selectinload(Event.attachments))
        .where(Event.id == event_id, Event.user_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


# ── Per-note CRUD ──────────────────────────────────────────────────────────────

@router.get("/api/notes/{note_id}/events", response_model=List[EventResponse])
async def list_events(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    result = await db.execute(
        select(Event)
        .options(selectinload(Event.attachments))
        .where(Event.note_id == note_id, Event.user_id == current_user.id)
        .order_by(Event.start_datetime)
    )
    return result.scalars().all()


@router.post("/api/notes/{note_id}/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    note_id: int,
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    event = Event(
        note_id=note_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        url=payload.url,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    # reload with attachments
    result = await db.execute(
        select(Event).options(selectinload(Event.attachments)).where(Event.id == event.id)
    )
    return result.scalar_one()


@router.put("/api/notes/{note_id}/events/{event_id}", response_model=EventResponse)
async def update_event(
    note_id: int,
    event_id: int,
    payload: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    event = await _get_event_owned(event_id, current_user, db)
    if event.note_id != note_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    for field in payload.model_fields_set:
        setattr(event, field, getattr(payload, field))
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(event)
    result = await db.execute(
        select(Event).options(selectinload(Event.attachments)).where(Event.id == event.id)
    )
    return result.scalar_one()


@router.delete("/api/notes/{note_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    note_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    event = await _get_event_owned(event_id, current_user, db)
    if event.note_id != note_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    # delete attachment files from disk
    for att in event.attachments:
        path = os.path.join(UPLOAD_BASE, str(current_user.id), "events", str(event_id), att.stored_filename)
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
    await db.delete(event)


# ── Global calendar endpoint ───────────────────────────────────────────────────

@router.get("/api/events", response_model=List[EventWithNoteResponse])
async def list_all_events(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Event)
        .options(selectinload(Event.attachments), selectinload(Event.note))
        .where(Event.user_id == current_user.id)
        .order_by(Event.start_datetime)
    )
    if month:
        try:
            year, m = int(month.split("-")[0]), int(month.split("-")[1])
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be YYYY-MM")
        last_day = monthrange(year, m)[1]
        start = datetime(year, m, 1, tzinfo=timezone.utc)
        end = datetime(year, m, last_day, 23, 59, 59, tzinfo=timezone.utc)
        query = query.where(Event.start_datetime >= start, Event.start_datetime <= end)
    result = await db.execute(query)
    events = result.scalars().all()
    out = []
    for ev in events:
        d = EventWithNoteResponse.model_validate(ev)
        d.note_title = ev.note.title if ev.note else None
        out.append(d)
    return out


# ── Event Attachments ──────────────────────────────────────────────────────────

@router.get("/api/events/{event_id}/attachments", response_model=List[EventAttachmentResponse])
async def list_event_attachments(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await _get_event_owned(event_id, current_user, db)
    return event.attachments


@router.post("/api/events/{event_id}/attachments", response_model=EventAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_event_attachment(
    event_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_owned(event_id, current_user, db)
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"Unsupported file type: {content_type}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 10MB)")
    ext = os.path.splitext(file.filename or "")[1]
    stored = f"{uuid.uuid4()}{ext}"
    upload_dir = os.path.join(UPLOAD_BASE, str(current_user.id), "events", str(event_id))
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, stored)
    async with aiofiles.open(path, "wb") as f:
        await f.write(contents)
    att = EventAttachment(
        event_id=event_id,
        user_id=current_user.id,
        filename=file.filename or stored,
        stored_filename=stored,
        mime_type=content_type,
        size_bytes=len(contents),
        description=description,
    )
    db.add(att)
    await db.flush()
    await db.refresh(att)
    return att


@router.get("/api/events/{event_id}/attachments/{aid}/stream")
async def stream_event_attachment(
    event_id: int,
    aid: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_owned(event_id, current_user, db)
    result = await db.execute(
        select(EventAttachment).where(
            EventAttachment.id == aid,
            EventAttachment.event_id == event_id,
            EventAttachment.user_id == current_user.id,
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = os.path.join(UPLOAD_BASE, str(current_user.id), "events", str(event_id), att.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    if att.mime_type.startswith(("image/", "application/pdf")):
        disposition = f'inline; filename="{att.filename}"'
    else:
        disposition = f'attachment; filename="{att.filename}"'
    return FileResponse(path, media_type=att.mime_type, headers={"Content-Disposition": disposition})


@router.delete("/api/events/{event_id}/attachments/{aid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_attachment(
    event_id: int,
    aid: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_event_owned(event_id, current_user, db)
    result = await db.execute(
        select(EventAttachment).where(
            EventAttachment.id == aid,
            EventAttachment.event_id == event_id,
            EventAttachment.user_id == current_user.id,
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = os.path.join(UPLOAD_BASE, str(current_user.id), "events", str(event_id), att.stored_filename)
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    await db.delete(att)
