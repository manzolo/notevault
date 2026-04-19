from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_owned_note
from app.database.connection import get_db
from app.models.database import Note, NoteField
from app.schemas.fields import (
    NoteFieldCreate,
    NoteFieldReorderItem,
    NoteFieldResponse,
    NoteFieldUpdate,
)

router = APIRouter(prefix="/api/notes/{note_id}/fields", tags=["note_fields"])


@router.get("", response_model=List[NoteFieldResponse])
async def list_fields(
    note_id: int,
    note: Note = Depends(get_owned_note),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NoteField)
        .where(NoteField.note_id == note_id)
        .order_by(NoteField.position, NoteField.id)
    )
    return result.scalars().all()


@router.post("", response_model=NoteFieldResponse, status_code=201)
async def create_field(
    note_id: int,
    data: NoteFieldCreate,
    note: Note = Depends(get_owned_note),
    db: AsyncSession = Depends(get_db),
):
    field = NoteField(note_id=note_id, **data.model_dump())
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.put("/{field_id}", response_model=NoteFieldResponse)
async def update_field(
    note_id: int,
    field_id: int,
    data: NoteFieldUpdate,
    note: Note = Depends(get_owned_note),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NoteField).where(NoteField.id == field_id, NoteField.note_id == note_id)
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(field, k, v)
    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/{field_id}", status_code=204)
async def delete_field(
    note_id: int,
    field_id: int,
    note: Note = Depends(get_owned_note),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NoteField).where(NoteField.id == field_id, NoteField.note_id == note_id)
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    await db.delete(field)
    await db.commit()


@router.patch("/reorder", status_code=200)
async def reorder_fields(
    note_id: int,
    items: List[NoteFieldReorderItem],
    note: Note = Depends(get_owned_note),
    db: AsyncSession = Depends(get_db),
):
    for item in items:
        result = await db.execute(
            select(NoteField).where(NoteField.id == item.id, NoteField.note_id == note_id)
        )
        field = result.scalar_one_or_none()
        if field:
            field.position = item.position
    await db.commit()
    return {"ok": True}
