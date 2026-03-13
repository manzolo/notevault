import os
import secrets
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database.connection import get_db
from app.models.database import Attachment, Bookmark, Event, Note, Secret, ShareToken, Tag, Task, User
from app.schemas.note import NoteResponse
from app.security.auth import verify_token
from app.security.dependencies import get_current_user
from app.security.encryption import get_encryption
from app.security.rate_limit import limiter

router = APIRouter(tags=["share"])
settings = get_settings()

_bearer = HTTPBearer(auto_error=False)

_INLINE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"
}

_DEFAULT_SECTIONS = {
    "content": True,
    "tasks": False,
    "attachments": False,
    "bookmarks": False,
    "secrets": False,
    "events": False,
}


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Return the authenticated user if a valid Bearer token is provided, else None."""
    if credentials is None:
        return None
    payload = verify_token(credentials.credentials)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


class ShareSections(BaseModel):
    content: bool = True
    tasks: bool = False
    attachments: bool = False
    bookmarks: bool = False
    secrets: bool = False
    events: bool = False


class ShareCreate(BaseModel):
    sections: ShareSections = ShareSections()
    visibility: str = "public"
    allowed_user_id: Optional[int] = None


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

    # Validate visibility value
    if body.visibility not in ("public", "users", "specific"):
        raise HTTPException(status_code=422, detail="visibility must be 'public', 'users', or 'specific'")

    # For 'specific' visibility, allowed_user_id is required
    if body.visibility == "specific" and body.allowed_user_id is None:
        raise HTTPException(status_code=422, detail="allowed_user_id is required when visibility is 'specific'")

    sections_dict = body.sections.model_dump()

    # Check if a share token already exists — update and return
    existing = await db.execute(
        select(ShareToken).where(ShareToken.note_id == note_id)
    )
    existing_token = existing.scalar_one_or_none()
    if existing_token:
        existing_token.share_sections = sections_dict
        existing_token.visibility = body.visibility
        existing_token.allowed_user_id = body.allowed_user_id
        await db.commit()
        return {
            "token": existing_token.token,
            "share_sections": sections_dict,
            "visibility": body.visibility,
            "allowed_user_id": body.allowed_user_id,
        }

    token = secrets.token_urlsafe(32)
    share = ShareToken(
        note_id=note_id,
        user_id=current_user.id,
        token=token,
        share_sections=sections_dict,
        visibility=body.visibility,
        allowed_user_id=body.allowed_user_id,
    )
    db.add(share)
    await db.commit()
    return {
        "token": token,
        "share_sections": sections_dict,
        "visibility": body.visibility,
        "allowed_user_id": body.allowed_user_id,
    }


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
        return {
            "token": None,
            "share_sections": _DEFAULT_SECTIONS,
            "visibility": "public",
            "allowed_user_id": None,
        }
    return {
        "token": share.token,
        "share_sections": share.share_sections or _DEFAULT_SECTIONS,
        "visibility": share.visibility or "public",
        "allowed_user_id": share.allowed_user_id,
    }


@router.get("/api/share/{token}")
@limiter.limit("30/minute")
async def get_shared_note(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    visibility = share.visibility or "public"

    # Enforce visibility access control
    if visibility == "users":
        if current_user is None:
            raise HTTPException(status_code=401, detail="Login required to view this shared note")
    elif visibility == "specific":
        if current_user is None:
            raise HTTPException(status_code=401, detail="Login required to view this shared note")
        if current_user.id != share.allowed_user_id and current_user.id != share.user_id:
            raise HTTPException(status_code=403, detail="You are not authorized to view this shared note")

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
        "visibility": visibility,
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

    # Events section
    if sections.get("events", False):
        ev_result = await db.execute(
            select(Event)
            .where(Event.note_id == note.id)
            .order_by(Event.start_datetime)
        )
        events = ev_result.scalars().all()
        response["events"] = [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "start_datetime": e.start_datetime,
                "end_datetime": e.end_datetime,
                "url": e.url,
            }
            for e in events
        ]

    return response


@router.get("/api/share/{token}/attachments/{attachment_id}")
@limiter.limit("60/minute")
async def download_shared_attachment(
    token: str,
    attachment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Public endpoint to stream an attachment from a shared note."""
    # Validate share token and that attachments section is enabled
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    visibility = share.visibility or "public"

    # Enforce visibility access control
    if visibility == "users":
        if current_user is None:
            raise HTTPException(status_code=401, detail="Login required to access this attachment")
    elif visibility == "specific":
        if current_user is None:
            raise HTTPException(status_code=401, detail="Login required to access this attachment")
        if current_user.id != share.allowed_user_id and current_user.id != share.user_id:
            raise HTTPException(status_code=403, detail="You are not authorized to access this attachment")

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


@router.get("/api/users/search")
async def search_users(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username or email (for share visibility picker). Excludes the current user."""
    if not q or len(q.strip()) < 2:
        return []
    q_lower = f"%{q.strip().lower()}%"
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user.id,
            User.is_active == True,
            or_(
                User.username.ilike(q_lower),
                User.email.ilike(q_lower),
            ),
        )
        .limit(10)
    )
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "email": u.email} for u in users]
