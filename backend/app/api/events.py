import os
import secrets
import uuid
import aiofiles
from calendar import monthrange
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse, Response
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


def _expand_recurring(ev: Event, note_title: Optional[str], window_start: datetime, window_end: datetime) -> List[EventWithNoteResponse]:
    """Expand a recurring event into individual occurrences within the window."""
    try:
        from dateutil.rrule import rrulestr
    except ImportError:
        base = EventWithNoteResponse.model_validate(ev)
        base.note_title = note_title
        return [base]

    try:
        rule = rrulestr(ev.recurrence_rule, dtstart=ev.start_datetime)
    except Exception:
        base = EventWithNoteResponse.model_validate(ev)
        base.note_title = note_title
        return [base]

    # Compute duration for shifting end_datetime
    duration: Optional[timedelta] = None
    if ev.end_datetime:
        duration = ev.end_datetime - ev.start_datetime

    # Search from (window_start - duration) so multi-day occurrences that
    # started before the window but span into it are not missed.
    search_start = window_start - duration if duration else window_start
    occurrences = list(rule.between(search_start, window_end, inc=True))
    result = []
    for occ in occurrences:
        occ_end = occ + duration if duration is not None else None
        # Skip occurrences whose end falls before the window starts
        if (occ_end if occ_end is not None else occ) < window_start:
            continue
        base = EventWithNoteResponse.model_validate(ev)
        base.note_title = note_title
        base.start_datetime = occ
        base.end_datetime = occ_end
        result.append(base)
    return result


# ── Per-note CRUD ──────────────────────────────────────────────────────────────

@router.get("/api/notes/{note_id}/events", response_model=List[EventResponse])
async def list_events(
    note_id: int,
    include_archived: bool = Query(False),
    archived_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_note_owned(note_id, current_user, db)
    q = (
        select(Event)
        .options(selectinload(Event.attachments))
        .where(Event.note_id == note_id, Event.user_id == current_user.id)
    )
    if archived_only:
        q = q.where(Event.is_archived == True)  # noqa: E712
    elif not include_archived:
        q = q.where(Event.is_archived == False)  # noqa: E712
    result = await db.execute(q.order_by(Event.start_datetime))
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
        recurrence_rule=payload.recurrence_rule,
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
    if month:
        try:
            year, m = int(month.split("-")[0]), int(month.split("-")[1])
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be YYYY-MM")
        last_day = monthrange(year, m)[1]
        window_start = datetime(year, m, 1, tzinfo=timezone.utc)
        window_end = datetime(year, m, last_day, 23, 59, 59, tzinfo=timezone.utc)

        # Fetch non-recurring events that overlap the window
        # (start <= window_end AND coalesce(end, start) >= window_start)
        from sqlalchemy import func as sqlfunc
        non_recurring_q = (
            select(Event)
            .options(selectinload(Event.attachments), selectinload(Event.note))
            .where(
                Event.user_id == current_user.id,
                Event.recurrence_rule.is_(None),
                Event.is_archived == False,  # noqa: E712
                Event.start_datetime <= window_end,
                sqlfunc.coalesce(Event.end_datetime, Event.start_datetime) >= window_start,
            )
            .order_by(Event.start_datetime)
        )
        # Fetch all recurring events (need to check occurrences in window)
        recurring_q = (
            select(Event)
            .options(selectinload(Event.attachments), selectinload(Event.note))
            .where(
                Event.user_id == current_user.id,
                Event.recurrence_rule.isnot(None),
                Event.is_archived == False,  # noqa: E712
            )
        )

        non_recurring_result = await db.execute(non_recurring_q)
        recurring_result = await db.execute(recurring_q)
        non_recurring_events = non_recurring_result.scalars().all()
        recurring_events = recurring_result.scalars().all()

        out = []
        for ev in non_recurring_events:
            d = EventWithNoteResponse.model_validate(ev)
            d.note_title = ev.note.title if ev.note else None
            out.append(d)

        for ev in recurring_events:
            note_title = ev.note.title if ev.note else None
            out.extend(_expand_recurring(ev, note_title, window_start, window_end))

        out.sort(key=lambda e: e.start_datetime)
        return out

    # No month filter — return all non-archived events
    query = (
        select(Event)
        .options(selectinload(Event.attachments), selectinload(Event.note))
        .where(
            Event.user_id == current_user.id,
            Event.is_archived == False,  # noqa: E712
        )
        .order_by(Event.start_datetime)
    )
    result = await db.execute(query)
    events = result.scalars().all()
    out = []
    for ev in events:
        d = EventWithNoteResponse.model_validate(ev)
        d.note_title = ev.note.title if ev.note else None
        out.append(d)
    return out


# ── iCalendar export ───────────────────────────────────────────────────────────

@router.get("/api/events/export/calendar.ics")
async def export_calendar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _build_ical_response(current_user, db)


# ── Calendar feed token management ────────────────────────────────────────────

@router.get("/api/events/feed-token")
async def get_feed_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's calendar feed token, generating one if it doesn't exist."""
    if not current_user.calendar_token:
        current_user.calendar_token = secrets.token_urlsafe(32)
        await db.flush()
    return {"token": current_user.calendar_token}


@router.post("/api/events/feed-token/regenerate")
async def regenerate_feed_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the old token and generate a new one."""
    current_user.calendar_token = secrets.token_urlsafe(32)
    await db.flush()
    return {"token": current_user.calendar_token}


@router.get("/api/events/feed/{token}/calendar.ics")
async def public_calendar_feed(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public calendar feed endpoint — authenticated via token, no JWT required."""
    result = await db.execute(select(User).where(User.calendar_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
    return await _build_ical_response(user, db)


async def _build_ical_response(user: User, db: AsyncSession) -> Response:
    """Build the iCalendar response for a given user."""
    from icalendar import Calendar, Event as IEvent
    from icalendar.prop import vRecur

    now = datetime.now(timezone.utc)

    non_recurring_q = (
        select(Event)
        .where(
            Event.user_id == user.id,
            Event.recurrence_rule.is_(None),
            Event.is_archived == False,  # noqa: E712
            Event.start_datetime >= now,
        )
        .order_by(Event.start_datetime)
    )
    recurring_q = (
        select(Event)
        .where(
            Event.user_id == user.id,
            Event.recurrence_rule.isnot(None),
            Event.is_archived == False,  # noqa: E712
        )
    )

    non_recurring_result = await db.execute(non_recurring_q)
    recurring_result = await db.execute(recurring_q)
    events_to_export = list(non_recurring_result.scalars().all()) + list(recurring_result.scalars().all())

    cal = Calendar()
    cal.add("prodid", "-//NoteVault//notevault//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-calname", f"NoteVault - {user.username}")

    for ev in events_to_export:
        iev = IEvent()
        iev.add("uid", f"notevault-event-{ev.id}@notevault")
        iev.add("summary", ev.title)
        iev.add("dtstart", ev.start_datetime)
        if ev.end_datetime:
            iev.add("dtend", ev.end_datetime)
        if ev.description:
            iev.add("description", ev.description)
        if ev.url:
            iev.add("url", ev.url)
        iev.add("dtstamp", now)
        iev.add("created", ev.created_at)
        iev.add("last-modified", ev.updated_at)
        if ev.recurrence_rule:
            try:
                iev.add("rrule", vRecur.from_ical(ev.recurrence_rule))
            except Exception:
                pass
        cal.add_component(iev)

    return Response(
        content=cal.to_ical(),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="notevault-calendar.ics"'},
    )


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
