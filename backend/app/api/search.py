import re
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, exists, select, func
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Attachment, Bookmark, Event, Note, NoteField, NoteTag, User
from app.schemas.search import MatchingAttachment, MatchingBookmark, MatchingEvent, MatchingField, SearchResponse, SearchNoteResponse
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])

_LANG = "simple"


def _build_tsquery(q: str):
    """Build a prefix-aware tsquery: each token becomes token:* so partial words match."""
    tokens = re.findall(r'\w+', q)
    if not tokens:
        return func.plainto_tsquery(_LANG, q)
    prefix_expr = ' & '.join(f'{t}:*' for t in tokens)
    return func.to_tsquery(_LANG, prefix_expr)


@router.get("", response_model=SearchResponse)
async def search_notes(
    q: str = Query(..., min_length=1),
    tag_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tsquery = _build_tsquery(q)

    # Correlated subquery: True if the note has matching attachments
    attachment_match = (
        exists()
        .where(
            Attachment.note_id == Note.id,
            Attachment.fts_vector.op("@@")(tsquery),
        )
        .correlate(Note)
        .label("match_in_attachment")
    )

    # Correlated subquery: True if the note has matching bookmarks
    bookmark_match = (
        exists()
        .where(
            Bookmark.note_id == Note.id,
            Bookmark.fts_vector.op("@@")(tsquery),
        )
        .correlate(Note)
        .label("match_in_bookmark")
    )

    # Correlated subquery: True if the note has matching fields
    fields_match = (
        exists()
        .where(
            NoteField.note_id == Note.id,
            NoteField.fts_vector.op("@@")(tsquery),
        )
        .correlate(Note)
        .label("match_in_fields")
    )

    # Correlated subquery: True if the note has matching events
    event_match = (
        exists()
        .where(
            Event.note_id == Note.id,
            Event.is_archived == False,  # noqa: E712
            Event.fts_vector.op("@@")(tsquery),
        )
        .correlate(Note)
        .label("match_in_event")
    )

    base_where = [
        Note.user_id == current_user.id,
        or_(
            Note.fts_vector.op("@@")(tsquery),
            exists().where(
                Attachment.note_id == Note.id,
                Attachment.fts_vector.op("@@")(tsquery),
            ),
            exists().where(
                Bookmark.note_id == Note.id,
                Bookmark.fts_vector.op("@@")(tsquery),
            ),
            exists().where(
                NoteField.note_id == Note.id,
                NoteField.fts_vector.op("@@")(tsquery),
            ),
            exists().where(
                Event.note_id == Note.id,
                Event.is_archived == False,  # noqa: E712
                Event.fts_vector.op("@@")(tsquery),
            ),
        ),
    ]

    # Separate count subquery (avoids issues with labelled scalar subqueries)
    count_subq = select(Note.id).where(*base_where)
    if tag_id:
        count_subq = count_subq.join(NoteTag, NoteTag.note_id == Note.id).where(
            NoteTag.tag_id == tag_id
        )
    total = (
        await db.execute(select(func.count()).select_from(count_subq.subquery()))
    ).scalar()

    pages = max(1, -(-total // per_page))  # ceiling division

    # Main query with attachment_match, bookmark_match, fields_match and event_match columns
    query = (
        select(Note, attachment_match, bookmark_match, fields_match, event_match)
        .options(selectinload(Note.tags))
        .where(*base_where)
        .order_by(func.ts_rank(Note.fts_vector, tsquery).desc())
    )

    if tag_id:
        query = query.join(NoteTag, NoteTag.note_id == Note.id).where(
            NoteTag.tag_id == tag_id
        )

    query = query.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).all()

    # Batch-fetch matching attachments for notes that have a match
    matching_att_map: dict = defaultdict(list)
    att_note_ids = [note.id for note, ma, mb, mf, me in rows if ma]
    if att_note_ids:
        att_q = select(
            Attachment.id, Attachment.note_id, Attachment.filename, Attachment.mime_type
        ).where(
            Attachment.note_id.in_(att_note_ids),
            Attachment.fts_vector.op("@@")(tsquery),
        )
        for att_id, att_note_id, att_filename, att_mime in (await db.execute(att_q)).all():
            matching_att_map[att_note_id].append(
                MatchingAttachment(id=att_id, note_id=att_note_id, filename=att_filename, mime_type=att_mime)
            )

    # Batch-fetch matching bookmarks for notes that have a match
    matching_bm_map: dict = defaultdict(list)
    bm_note_ids = [note.id for note, ma, mb, mf, me in rows if mb]
    if bm_note_ids:
        bm_q = select(
            Bookmark.id, Bookmark.note_id, Bookmark.url, Bookmark.title, Bookmark.description
        ).where(
            Bookmark.note_id.in_(bm_note_ids),
            Bookmark.fts_vector.op("@@")(tsquery),
        )
        for bm_id, bm_note_id, bm_url, bm_title, bm_desc in (await db.execute(bm_q)).all():
            matching_bm_map[bm_note_id].append(
                MatchingBookmark(id=bm_id, note_id=bm_note_id, url=bm_url, title=bm_title, description=bm_desc)
            )

    # Batch-fetch matching fields for notes that have a match
    matching_fields_map: dict = defaultdict(list)
    fields_note_ids = [note.id for note, ma, mb, mf, me in rows if mf]
    if fields_note_ids:
        fld_q = select(
            NoteField.id, NoteField.note_id, NoteField.group_name, NoteField.key, NoteField.value
        ).where(
            NoteField.note_id.in_(fields_note_ids),
            NoteField.fts_vector.op("@@")(tsquery),
        )
        for fld_id, fld_note_id, fld_group, fld_key, fld_value in (await db.execute(fld_q)).all():
            matching_fields_map[fld_note_id].append(
                MatchingField(id=fld_id, note_id=fld_note_id, group_name=fld_group, key=fld_key, value=fld_value)
            )

    # Batch-fetch matching events for notes that have a match
    matching_events_map: dict = defaultdict(list)
    event_note_ids = [note.id for note, ma, mb, mf, me in rows if me]
    if event_note_ids:
        ev_q = select(
            Event.id, Event.note_id, Event.title, Event.description, Event.start_datetime
        ).where(
            Event.note_id.in_(event_note_ids),
            Event.is_archived == False,  # noqa: E712
            Event.fts_vector.op("@@")(tsquery),
        )
        for ev_id, ev_note_id, ev_title, ev_desc, ev_start in (await db.execute(ev_q)).all():
            matching_events_map[ev_note_id].append(
                MatchingEvent(
                    id=ev_id,
                    note_id=ev_note_id,
                    title=ev_title,
                    description=ev_desc,
                    start_datetime=ev_start.isoformat(),
                )
            )

    items = []
    for note, match_attachment, match_bookmark, match_fields, match_event in rows:
        item = SearchNoteResponse.model_validate(note)
        item.match_in_attachment = bool(match_attachment)
        item.match_in_bookmark = bool(match_bookmark)
        item.match_in_fields = bool(match_fields)
        item.match_in_event = bool(match_event)
        item.matching_attachments = matching_att_map.get(note.id, [])
        item.matching_bookmarks = matching_bm_map.get(note.id, [])
        item.matching_fields = matching_fields_map.get(note.id, [])
        item.matching_events = matching_events_map.get(note.id, [])
        items.append(item)

    return SearchResponse(items=items, total=total, query=q, page=page, per_page=per_page, pages=pages)
