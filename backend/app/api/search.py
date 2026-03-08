from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.database import Note, Tag, NoteTag, User
from app.schemas.search import SearchResponse
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
    query = (
        select(Note)
        .options(selectinload(Note.tags))
        .where(
            Note.user_id == current_user.id,
            Note.fts_vector.op("@@")(func.plainto_tsquery("english", q)),
        )
        .order_by(
            func.ts_rank(Note.fts_vector, func.plainto_tsquery("english", q)).desc()
        )
    )

    if tag_id:
        query = query.join(NoteTag, NoteTag.note_id == Note.id).where(NoteTag.tag_id == tag_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    notes = result.scalars().all()

    return SearchResponse(items=list(notes), total=total, query=q)
