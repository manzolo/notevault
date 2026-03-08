from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, exists, select, func
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Attachment, Note, NoteTag, User
from app.schemas.search import SearchResponse, SearchNoteResponse
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search_notes(
    q: str = Query(..., min_length=1),
    tag_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tsquery = func.plainto_tsquery("english", q)

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

    base_where = [
        Note.user_id == current_user.id,
        or_(
            Note.fts_vector.op("@@")(tsquery),
            exists().where(
                Attachment.note_id == Note.id,
                Attachment.fts_vector.op("@@")(tsquery),
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

    # Main query with attachment_match column
    query = (
        select(Note, attachment_match)
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

    items = []
    for note, match_bool in rows:
        item = SearchNoteResponse.model_validate(note)
        item.match_in_attachment = bool(match_bool)
        items.append(item)

    return SearchResponse(items=items, total=total, query=q)
