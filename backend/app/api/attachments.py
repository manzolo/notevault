import os
from typing import List
from urllib.parse import quote
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database.connection import get_db
from app.models.database import Attachment, AttachmentTag, Note, Tag, User
from app.schemas.attachment import AttachmentResponse, AttachmentTagUpdate
from app.security.dependencies import get_current_user
from app.security.file_validation import sanitize_filename, validate
from app.services.text_extraction import extract_text

router = APIRouter(prefix="/api/notes", tags=["attachments"])
settings = get_settings()

# MIME types shown inline in browser
_INLINE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"
}


async def _get_owned_note(note_id: int, user: User, db: AsyncSession) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


async def _get_attachment(attachment_id: int, note_id: int, db: AsyncSession) -> Attachment:
    result = await db.execute(
        select(Attachment)
        .options(selectinload(Attachment.tags))
        .where(Attachment.id == attachment_id, Attachment.note_id == note_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return attachment


@router.post(
    "/{note_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    note_id: int,
    file: UploadFile,
    tag_ids: List[int] = Form(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)

    # Stream-read to enforce size limit
    max_bytes = settings.max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(65536)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_bytes // 1024 // 1024} MB",
            )
        chunks.append(chunk)

    file_bytes = b"".join(chunks)
    original_name = sanitize_filename(file.filename or "upload")

    # Validate MIME from magic bytes
    mime_type, ext = validate(file_bytes[:128], original_name)

    stored_name = f"{uuid4()}{ext}"
    upload_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
    os.makedirs(upload_dir, exist_ok=True)
    full_path = os.path.join(upload_dir, stored_name)

    async with aiofiles.open(full_path, "wb") as f:
        await f.write(file_bytes)

    extracted = await extract_text(full_path, mime_type)

    attachment = Attachment(
        note_id=note_id,
        filename=original_name,
        stored_filename=stored_name,
        mime_type=mime_type,
        size_bytes=total,
        extracted_text=extracted,
    )
    db.add(attachment)
    await db.flush()

    # Attach tags (validate ownership)
    if tag_ids:
        owned_tags_result = await db.execute(
            select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == current_user.id)
        )
        owned_tag_ids = {t.id for t in owned_tags_result.scalars().all()}
        for tid in tag_ids:
            if tid in owned_tag_ids:
                db.add(AttachmentTag(attachment_id=attachment.id, tag_id=tid))

    await db.flush()
    await db.refresh(attachment)
    # reload with tags
    result = await db.execute(
        select(Attachment)
        .options(selectinload(Attachment.tags))
        .where(Attachment.id == attachment.id)
    )
    return result.scalar_one()


@router.get("/{note_id}/attachments", response_model=List[AttachmentResponse])
async def list_attachments(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    result = await db.execute(
        select(Attachment)
        .options(selectinload(Attachment.tags))
        .where(Attachment.note_id == note_id)
    )
    return result.scalars().all()


@router.get("/{note_id}/attachments/{attachment_id}", response_model=AttachmentResponse)
async def get_attachment(
    note_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    return await _get_attachment(attachment_id, note_id, db)


@router.get("/{note_id}/attachments/{attachment_id}/stream")
async def stream_attachment(
    note_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    attachment = await _get_attachment(attachment_id, note_id, db)

    upload_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
    full_path = os.path.join(upload_dir, attachment.stored_filename)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    encoded_name = quote(attachment.filename, safe="")
    if attachment.mime_type in _INLINE_MIMES:
        disposition = f"inline; filename*=UTF-8''{encoded_name}"
    else:
        disposition = f"attachment; filename*=UTF-8''{encoded_name}"

    return FileResponse(
        full_path,
        media_type=attachment.mime_type,
        headers={"Content-Disposition": disposition},
    )


@router.put("/{note_id}/attachments/{attachment_id}/tags", response_model=AttachmentResponse)
async def update_attachment_tags(
    note_id: int,
    attachment_id: int,
    body: AttachmentTagUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    attachment = await _get_attachment(attachment_id, note_id, db)

    # Delete existing tags
    existing_result = await db.execute(
        select(AttachmentTag).where(AttachmentTag.attachment_id == attachment.id)
    )
    for at in existing_result.scalars().all():
        await db.delete(at)

    # Validate and insert new tags
    if body.tag_ids:
        owned_tags_result = await db.execute(
            select(Tag).where(Tag.id.in_(body.tag_ids), Tag.user_id == current_user.id)
        )
        owned_tag_ids = {t.id for t in owned_tags_result.scalars().all()}
        for tid in body.tag_ids:
            if tid in owned_tag_ids:
                db.add(AttachmentTag(attachment_id=attachment.id, tag_id=tid))

    await db.flush()

    # Reload with updated tags (populate_existing bypasses identity-map cache)
    result = await db.execute(
        select(Attachment)
        .options(selectinload(Attachment.tags))
        .where(Attachment.id == attachment.id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.delete("/{note_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    note_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    attachment = await _get_attachment(attachment_id, note_id, db)

    upload_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
    full_path = os.path.join(upload_dir, attachment.stored_filename)
    try:
        os.remove(full_path)
    except FileNotFoundError:
        pass

    await db.delete(attachment)
