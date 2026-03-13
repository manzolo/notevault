import os
import secrets
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database.connection import get_db
from app.models.database import Attachment, Bookmark, Note, Secret, ShareToken, Tag, Task
from app.schemas.note import NoteResponse
from app.security.dependencies import get_current_user
from app.models.database import User
from app.security.encryption import get_encryption
from app.security.rate_limit import limiter

router = APIRouter(tags=["share"])
settings = get_settings()

_INLINE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"
}

_DEFAULT_SECTIONS = {
    "content": True,
    "tasks": False,
    "attachments": False,
    "bookmarks": False,
    "secrets": False,
}


class ShareSections(BaseModel):
    content: bool = True
    tasks: bool = False
    attachments: bool = False
    bookmarks: bool = False
    secrets: bool = False


class ShareCreate(BaseModel):
    sections: ShareSections = ShareSections()


@router.post("/api/notes/{note_id}/share", status_code=201)
async def create_share_token(
    note_id: int,
    body: ShareCreate = ShareCreate(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    sections_dict = body.sections.model_dump()

    # Check if a share token already exists — update sections and return
    existing = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id)
    )
    existing_token = existing.scalar_one_or_none()
    if existing_token:
        existing_token.share_sections = sections_dict
        await db.commit()
        return {"token": existing_token.token, "share_sections": sections_dict}

    token = secrets.token_urlsafe(32)
    share = ShareToken(
        note_id=note_id,
        user_id=current_user.id,
        token=token,
        share_sections=sections_dict,
    )
    db.add(share)
    await db.commit()
    return {"token": token, "share_sections": sections_dict}


@router.delete("/api/notes/{note_id}/share", status_code=204)
async def delete_share_token(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id, ShareToken.user_id == current_user.id)
    )
    share = result.scalar_one_or_none()
    if share:
        await db.delete(share)
        await db.commit()


@router.get("/api/notes/{note_id}/share")
async def get_share_status(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id)
    )
    share = result.scalar_one_or_none()
    if not share:
        return {"token": None, "share_sections": _DEFAULT_SECTIONS}
    return {
        "token": share.token,
        "share_sections": share.share_sections or _DEFAULT_SECTIONS,
    }


@router.get("/api/share/{token}")
@limiter.limit("30/minute")
async def get_shared_note(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    sections: dict = share.share_sections or _DEFAULT_SECTIONS

    # Always load the note with tags
    result = await db.execute(
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.id == share.note_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    response: dict = {
        "id": note.id,
        "title": note.title,
        "tags": [{"id": t.id, "name": t.name} for t in note.tags],
        "created_at": note.created_at,
        "updated_at": note.updated_at,
        "share_sections": sections,
    }

    # Content section
    if sections.get("content", True):
        response["content"] = note.content

    # Tasks section
    if sections.get("tasks", False):
        tasks_result = await db.execute(
            select(Task)
            .where(Task.note_id == note.id)
            .order_by(Task.position, Task.id)
        )
        tasks = tasks_result.scalars().all()
        response["tasks"] = [
            {
                "id": t.id,
                "title": t.title,
                "is_done": t.is_done,
                "due_date": t.due_date,
                "position": t.position,
            }
            for t in tasks
        ]

    # Attachments section (metadata only; download via dedicated endpoint)
    if sections.get("attachments", False):
        att_result = await db.execute(
            select(Attachment).where(Attachment.note_id == note.id)
        )
        attachments = att_result.scalars().all()
        response["attachments"] = [
            {
                "id": a.id,
                "filename": a.filename,
                "mime_type": a.mime_type,
                "size_bytes": a.size_bytes,
                "description": a.description,
            }
            for a in attachments
        ]

    # Bookmarks section
    if sections.get("bookmarks", False):
        bm_result = await db.execute(
            select(Bookmark).where(Bookmark.note_id == note.id)
        )
        bookmarks = bm_result.scalars().all()
        response["bookmarks"] = [
            {
                "id": b.id,
                "url": b.url,
                "title": b.title,
                "description": b.description,
            }
            for b in bookmarks
        ]

    # Secrets section — decrypt and include values
    if sections.get("secrets", False):
        sec_result = await db.execute(
            select(Secret).where(Secret.note_id == note.id)
        )
        secrets_list = sec_result.scalars().all()
        enc = get_encryption()
        decrypted_secrets = []
        for s in secrets_list:
            try:
                value = enc.decrypt(bytes(s.encrypted_value))
            except Exception:
                value = ""
            decrypted_secrets.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "secret_type": s.secret_type.value if hasattr(s.secret_type, "value") else s.secret_type,
                    "username": s.username,
                    "url": s.url,
                    "public_key": s.public_key,
                    "value": value,
                }
            )
        response["secrets"] = decrypted_secrets

    return response


@router.get("/api/share/{token}/attachments/{attachment_id}")
@limiter.limit("60/minute")
async def download_shared_attachment(
    token: str,
    attachment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to stream an attachment from a shared note."""
    # Validate share token and that attachments section is enabled
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    sections: dict = share.share_sections or _DEFAULT_SECTIONS
    if not sections.get("attachments", False):
        raise HTTPException(status_code=403, detail="Attachments are not shared for this link")

    # Load the attachment and verify it belongs to the shared note
    att_result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.note_id == share.note_id,
        )
    )
    attachment = att_result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Resolve the file owner (user_id stored on the ShareToken)
    upload_dir = os.path.join(
        settings.upload_dir,
        str(share.user_id),
        str(share.note_id),
    )
    full_path = os.path.join(upload_dir, attachment.stored_filename)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

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
