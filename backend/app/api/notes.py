import os
import shutil
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Note, Tag, NoteTag, Attachment, Event, Category, Task
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
    category_id: Optional[int] = Query(None),
    unfiled: bool = Query(False),
    recursive: bool = Query(False),
    pinned_only: bool = Query(False),
    include_archived: bool = Query(False),
    archived_only: bool = Query(False),
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

    if category_id is not None:
        if recursive:
            # Recursive CTE: category + all descendants
            cat_cte = (
                select(Category.id.label('id'))
                .where(Category.id == category_id)
                .cte(name='cat_tree', recursive=True)
            )
            cat_cte = cat_cte.union_all(
                select(Category.id).where(Category.parent_id == cat_cte.c.id)
            )
            base_filter = base_filter & Note.category_id.in_(select(cat_cte.c.id))
        else:
            base_filter = base_filter & (Note.category_id == category_id)
    elif unfiled:
        base_filter = base_filter & Note.category_id.is_(None)

    if pinned_only:
        base_filter = base_filter & (Note.is_pinned == True)

    if archived_only:
        base_filter = base_filter & (Note.is_archived == True)
    elif not include_archived:
        base_filter = base_filter & (Note.is_archived == False)

    if created_after is not None or created_before is not None:
        from datetime import timezone as _tz
        from dateutil.rrule import rrulestr as _rrulestr

        note_date_conds = []
        # Overlap check for NON-recurring events:
        #   COALESCE(end_datetime, start_datetime) >= created_after  (event ends after range start)
        #   AND start_datetime <= created_before                      (event starts before range end)
        event_match_conds = [Event.note_id == Note.id, Event.recurrence_rule.is_(None)]
        if created_after is not None:
            note_date_conds.append(Note.created_at >= created_after)
            event_match_conds.append(
                func.coalesce(Event.end_datetime, Event.start_datetime) >= created_after
            )
        if created_before is not None:
            note_date_conds.append(Note.created_at <= created_before)
            event_match_conds.append(Event.start_datetime <= created_before)

        # Expand recurring events to find note IDs with occurrences in the range
        _win_start = created_after or datetime(1970, 1, 1, tzinfo=_tz.utc)
        _win_end = created_before or datetime(2999, 12, 31, 23, 59, 59, tzinfo=_tz.utc)
        # Ensure timezone-aware
        if _win_start.tzinfo is None:
            _win_start = _win_start.replace(tzinfo=_tz.utc)
        if _win_end.tzinfo is None:
            _win_end = _win_end.replace(tzinfo=_tz.utc)
        # For recurring events: expand window to full UTC days so that
        # occurrences near UTC midnight (e.g. 22:00 UTC) are not missed
        # when the local filter window ends before them (e.g. 21:59 UTC = 23:59 local).
        _rec_win_start = datetime(_win_start.year, _win_start.month, _win_start.day, 0, 0, 0, tzinfo=_tz.utc)
        _rec_win_end = datetime(_win_end.year, _win_end.month, _win_end.day, 23, 59, 59, tzinfo=_tz.utc)
        rec_result = await db.execute(
            select(Event.id, Event.note_id, Event.start_datetime, Event.end_datetime, Event.recurrence_rule)
            .where(Event.user_id == current_user.id, Event.recurrence_rule.isnot(None))
        )
        recurring_note_ids: list[int] = []
        for rec_id, rec_note_id, rec_start, rec_end, rec_rule in rec_result:
            try:
                rule = _rrulestr(rec_rule, dtstart=rec_start)
                duration = (rec_end - rec_start) if rec_end else None
                # Search from window_start - duration to catch multi-day occurrences
                # that started before the window but span into it
                search_start = _rec_win_start - duration if duration else _rec_win_start
                matched = False
                for occ in rule.between(search_start, _rec_win_end, inc=True):
                    occ_end = occ + duration if duration else occ
                    if occ_end >= _rec_win_start:
                        matched = True
                        break
                if matched:
                    recurring_note_ids.append(rec_note_id)
            except Exception:
                pass

        # Note has a non-recurring event overlapping the range
        event_in_range = select(Event.id).where(*event_match_conds).exists()
        # Note has a task with due_date in the range
        task_match_conds = [Task.note_id == Note.id, Task.is_archived == False]
        if created_after is not None:
            task_match_conds.append(Task.due_date >= created_after)
        if created_before is not None:
            task_match_conds.append(Task.due_date <= created_before)
        task_in_range = select(Task.id).where(*task_match_conds).exists()
        # Note has no events and no tasks with due_date in range (fall back to creation date)
        note_has_no_events = ~select(Event.id).where(Event.note_id == Note.id).exists()
        note_has_no_due_tasks = ~select(Task.id).where(
            Task.note_id == Note.id, Task.due_date.isnot(None), Task.is_archived == False
        ).exists()
        date_filter_parts: list = [
            event_in_range,
            task_in_range,
            and_(note_has_no_events, note_has_no_due_tasks, *note_date_conds),
        ]
        if recurring_note_ids:
            date_filter_parts.append(Note.id.in_(recurring_note_ids))
        base_filter = base_filter & or_(*date_filter_parts)
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
        is_archived=note_data.is_archived,
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


@router.get("/resolve")
async def resolve_notes(
    q: str = Query(""),
    exact: bool = Query(False),
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve note titles for wiki-links. Returns [{id, title}]."""
    if exact:
        if not q:
            return []
        stmt = select(Note.id, Note.title).where(
            Note.user_id == current_user.id,
            func.lower(Note.title) == q.lower()
        ).limit(1)
    elif q:
        stmt = select(Note.id, Note.title).where(
            Note.user_id == current_user.id,
            Note.title.ilike(f'%{q}%')
        ).order_by(Note.title).limit(limit)
    else:
        stmt = select(Note.id, Note.title).where(
            Note.user_id == current_user.id
        ).order_by(Note.updated_at.desc()).limit(limit)

    result = await db.execute(stmt)
    return [{"id": row.id, "title": row.title} for row in result.all()]


@router.get("/{note_id}/backlinks")
async def get_backlinks(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return notes that contain [[this note's title]] in their content (incoming wiki-links)."""
    result = await db.execute(
        select(Note.id, Note.title).where(
            Note.id == note_id,
            Note.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    pattern = f"%[[{row.title}]]%"
    stmt = select(Note.id, Note.title).where(
        Note.user_id == current_user.id,
        Note.id != note_id,
        Note.content.ilike(pattern),
    ).order_by(Note.title)
    result = await db.execute(stmt)
    return [{"id": r.id, "title": r.title} for r in result.all()]


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
    if note_data.is_archived is not None:
        note.is_archived = note_data.is_archived
    if "category_id" in note_data.model_fields_set:
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
