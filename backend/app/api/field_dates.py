from calendar import monthrange
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.database import Note, NoteField, User
from app.schemas.fields import FieldDateEntry
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/field-dates", tags=["note_fields"])


@router.get("", response_model=List[FieldDateEntry])
async def get_field_dates(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all note fields that have a date set, optionally filtered to a month."""
    q = (
        select(NoteField, Note.title.label("note_title"))
        .join(Note, Note.id == NoteField.note_id)
        .where(
            Note.user_id == current_user.id,
            NoteField.field_date.isnot(None),
        )
    )

    if month:
        try:
            year, m = int(month[:4]), int(month[5:7])
            month_start = date(year, m, 1)
            month_end = date(year, m, monthrange(year, m)[1])
            q = q.where(
                NoteField.field_date >= month_start,
                NoteField.field_date <= month_end,
            )
        except (ValueError, IndexError):
            pass  # ignore malformed month param — return all

    q = q.order_by(NoteField.field_date, NoteField.id)
    rows = (await db.execute(q)).all()

    return [
        FieldDateEntry(
            id=field.id,
            note_id=field.note_id,
            note_title=note_title,
            group_name=field.group_name,
            key=field.key,
            value=field.value,
            field_date=field.field_date,
            link=field.link,
            price=field.price,
        )
        for field, note_title in rows
    ]
