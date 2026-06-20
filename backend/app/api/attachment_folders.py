import asyncio
import io
import os
import zipfile
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_note
from app.config import get_settings
from app.database.connection import get_db
from app.models.database import Attachment, AttachmentFolder, Note, User
from app.security.dependencies import get_current_user
from app.security.file_validation import sanitize_filename

router = APIRouter(prefix="/api/notes", tags=["attachment-folders"])
settings = get_settings()


class AttachmentFolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class AttachmentFolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class AttachmentFolderResponse(BaseModel):
    id: int
    name: str
    note_id: int
    parent_id: Optional[int] = None
    position: int = 0
    updated_at: Optional[datetime] = None
    created_at: datetime
    attachment_count: int = 0
    children: List["AttachmentFolderResponse"] = []

    model_config = ConfigDict(from_attributes=True)


class FolderReorderItem(BaseModel):
    id: int
    position: int
    parent_id: Optional[int] = None


AttachmentFolderResponse.model_rebuild()


def _build_tree(
    all_folders: list[AttachmentFolder],
    counts: dict[int, int] | None = None,
) -> list[AttachmentFolderResponse]:
    """Build a nested AttachmentFolderResponse tree from a flat list of ORM objects."""
    cc = counts or {}
    nodes: dict[int, AttachmentFolderResponse] = {}
    positions: dict[int, int] = {}
    for folder in all_folders:
        positions[folder.id] = folder.position
        nodes[folder.id] = AttachmentFolderResponse(
            id=folder.id,
            name=folder.name,
            note_id=folder.note_id,
            parent_id=folder.parent_id,
            position=folder.position,
            updated_at=folder.updated_at,
            created_at=folder.created_at,
            attachment_count=cc.get(folder.id, 0),
            children=[],
        )

    roots: list[AttachmentFolderResponse] = []
    for folder in all_folders:
        node = nodes[folder.id]
        if folder.parent_id is None or folder.parent_id not in nodes:
            roots.append(node)
        else:
            nodes[folder.parent_id].children.append(node)

    # Manual order: sort each sibling list by position, then name as a stable tiebreaker.
    def _sort(nodes_list: list[AttachmentFolderResponse]) -> None:
        nodes_list.sort(key=lambda n: (n.position, n.name.lower()))
        for n in nodes_list:
            _sort(n.children)

    _sort(roots)
    return roots


async def _load_all_folders(db: AsyncSession, note_id: int) -> list[AttachmentFolder]:
    result = await db.execute(
        select(AttachmentFolder).where(AttachmentFolder.note_id == note_id)
    )
    return list(result.scalars().all())


async def _load_attachment_counts(db: AsyncSession, note_id: int) -> dict[int, int]:
    """Return {folder_id: attachment_count} for all folders of a note (non-archived, direct)."""
    result = await db.execute(
        select(Attachment.folder_id, func.count(Attachment.id))
        .where(
            Attachment.note_id == note_id,
            Attachment.folder_id.isnot(None),
            Attachment.is_archived == False,  # noqa: E712
        )
        .group_by(Attachment.folder_id)
    )
    return {folder_id: cnt for folder_id, cnt in result.all()}


def _get_descendant_ids(all_folders: list[AttachmentFolder], folder_id: int) -> list[int]:
    """Return folder_id plus all descendant IDs via BFS (uses pre-loaded list)."""
    children_map: dict[int, list[int]] = {}
    for folder in all_folders:
        children_map.setdefault(folder.parent_id, []).append(folder.id)

    ids = [folder_id]
    queue = [folder_id]
    while queue:
        cur = queue.pop()
        for child_id in children_map.get(cur, []):
            ids.append(child_id)
            queue.append(child_id)
    return ids


@router.get("/{note_id}/attachment-folders", response_model=List[AttachmentFolderResponse])
async def list_attachment_folders(
    note_id: int,
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the note's attachment-folder tree with per-folder attachment counts."""
    all_folders, counts = await asyncio.gather(
        _load_all_folders(db, note_id),
        _load_attachment_counts(db, note_id),
    )
    return _build_tree(all_folders, counts)


@router.patch("/{note_id}/attachment-folders/reorder", status_code=status.HTTP_200_OK)
async def reorder_attachment_folders(
    note_id: int,
    items: List[FolderReorderItem],
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set position (and optionally parent_id) for a batch of folders in one move.
    Used by drag-to-reorder: dropping between siblings reorders; the same call can
    also reparent the dragged folder when it changes level."""
    all_folders = await _load_all_folders(db, note_id)
    ids_in_note = {f.id for f in all_folders}

    for item in items:
        if item.id not in ids_in_note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Reject any reparent that would create a cycle (new parent is a descendant of the folder)
    for item in items:
        if "parent_id" in item.model_fields_set and item.parent_id is not None:
            if item.parent_id not in ids_in_note:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")
            if item.parent_id in _get_descendant_ids(all_folders, item.id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set a descendant as parent (circular reference)",
                )

    try:
        for item in items:
            values: dict = {"position": item.position}
            if "parent_id" in item.model_fields_set:
                values["parent_id"] = item.parent_id
            await db.execute(
                update(AttachmentFolder)
                .where(AttachmentFolder.id == item.id, AttachmentFolder.note_id == note_id)
                .values(**values)
            )
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A folder with this name already exists at the destination",
        )
    await db.commit()
    return {"ok": True}


@router.get("/{note_id}/attachment-folders/{folder_id}/download")
async def download_attachment_folder(
    note_id: int,
    folder_id: int,
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a zip of all (non-archived) attachments in the folder and its subfolders,
    preserving the subfolder structure inside the archive."""
    all_folders = await _load_all_folders(db, note_id)
    folder = next((f for f in all_folders if f.id == folder_id), None)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    descendant_ids = _get_descendant_ids(all_folders, folder_id)
    folder_by_id = {f.id: f for f in all_folders}

    def _rel_path(fid: int) -> str:
        """Path of folder `fid` relative to the requested folder (empty for the root itself)."""
        segments: list[str] = []
        cur: int | None = fid
        while cur is not None and cur != folder_id:
            f = folder_by_id.get(cur)
            if f is None:
                break
            segments.append(sanitize_filename(f.name) or f"folder-{f.id}")
            cur = f.parent_id
        return "/".join(reversed(segments))

    att_result = await db.execute(
        select(Attachment)
        .where(
            Attachment.note_id == note_id,
            Attachment.folder_id.in_(descendant_ids),
            Attachment.is_archived == False,  # noqa: E712
        )
        .order_by(Attachment.folder_id, Attachment.position, Attachment.created_at)
    )
    attachments = list(att_result.scalars().all())
    if not attachments:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder has no attachments")

    base_dir = os.path.join(settings.upload_dir, str(current_user.id), str(note_id))
    buf = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for a in attachments:
            disk_path = os.path.join(base_dir, a.stored_filename)
            if not os.path.exists(disk_path):
                continue
            rel = _rel_path(a.folder_id) if a.folder_id is not None else ""
            safe_name = sanitize_filename(a.filename) or f"file-{a.id}"
            arcname = f"{rel}/{safe_name}" if rel else safe_name
            # Deduplicate identical paths within the archive
            if arcname in used:
                root, ext = os.path.splitext(arcname)
                i = 1
                while f"{root} ({i}){ext}" in used:
                    i += 1
                arcname = f"{root} ({i}){ext}"
            used.add(arcname)
            zf.write(disk_path, arcname)

    buf.seek(0)
    zip_name = quote(f"{sanitize_filename(folder.name) or 'folder'}.zip", safe="")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{zip_name}"},
    )


@router.post(
    "/{note_id}/attachment-folders",
    response_model=AttachmentFolderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_attachment_folder(
    note_id: int,
    folder_data: AttachmentFolderCreate,
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if folder_data.parent_id is not None:
        parent_result = await db.execute(
            select(AttachmentFolder).where(
                AttachmentFolder.id == folder_data.parent_id,
                AttachmentFolder.note_id == note_id,
            )
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")

    dup_result = await db.execute(
        select(AttachmentFolder).where(
            AttachmentFolder.name == folder_data.name,
            AttachmentFolder.note_id == note_id,
            AttachmentFolder.parent_id == folder_data.parent_id,
        )
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Folder already exists at this level")

    # Place the new folder at the end of its sibling group
    max_pos = await db.execute(
        select(func.coalesce(func.max(AttachmentFolder.position), -1)).where(
            AttachmentFolder.note_id == note_id,
            AttachmentFolder.parent_id == folder_data.parent_id,
        )
    )
    next_position = max_pos.scalar_one() + 1

    folder = AttachmentFolder(
        name=folder_data.name,
        note_id=note_id,
        parent_id=folder_data.parent_id,
        position=next_position,
    )
    db.add(folder)
    await db.flush()
    await db.refresh(folder)

    return AttachmentFolderResponse(
        id=folder.id,
        name=folder.name,
        note_id=folder.note_id,
        parent_id=folder.parent_id,
        position=folder.position,
        updated_at=folder.updated_at,
        created_at=folder.created_at,
        children=[],
    )


@router.patch("/{note_id}/attachment-folders/{folder_id}", response_model=AttachmentFolderResponse)
async def update_attachment_folder(
    note_id: int,
    folder_id: int,
    folder_data: AttachmentFolderUpdate,
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AttachmentFolder).where(
            AttachmentFolder.id == folder_id,
            AttachmentFolder.note_id == note_id,
        )
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Compute the desired final name/parent WITHOUT mutating the ORM object yet:
    # mutating first would let SQLAlchemy autoflush the change during the checks
    # below and raise the unique-constraint IntegrityError before we can return 409.
    desired_name = folder_data.name if folder_data.name is not None else folder.name
    reparenting = "parent_id" in folder_data.model_fields_set
    desired_parent = folder_data.parent_id if reparenting else folder.parent_id

    if reparenting and desired_parent is not None:
        parent_result = await db.execute(
            select(AttachmentFolder).where(
                AttachmentFolder.id == desired_parent,
                AttachmentFolder.note_id == note_id,
            )
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")

        all_folders = await _load_all_folders(db, note_id)
        descendant_ids = _get_descendant_ids(all_folders, folder_id)
        if desired_parent in descendant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set a descendant as parent (circular reference)",
            )

    # Guard the unique (name, note_id, parent_id) constraint with a clear 409
    # instead of letting the DB raise an unhandled IntegrityError (→ 500).
    dup_result = await db.execute(
        select(AttachmentFolder.id).where(
            AttachmentFolder.name == desired_name,
            AttachmentFolder.note_id == note_id,
            AttachmentFolder.parent_id == desired_parent,
            AttachmentFolder.id != folder_id,
        )
    )
    if dup_result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A folder with this name already exists at the destination",
        )

    folder.name = desired_name
    folder.parent_id = desired_parent

    await db.flush()
    await db.refresh(folder)

    all_folders = await _load_all_folders(db, note_id)
    tree = _build_tree(all_folders)

    def _find(nodes: list[AttachmentFolderResponse], target_id: int) -> AttachmentFolderResponse | None:
        for n in nodes:
            if n.id == target_id:
                return n
            found = _find(n.children, target_id)
            if found:
                return found
        return None

    response = _find(tree, folder_id)
    if not response:
        return AttachmentFolderResponse(
            id=folder.id,
            name=folder.name,
            note_id=folder.note_id,
            parent_id=folder.parent_id,
            position=folder.position,
            updated_at=folder.updated_at,
            created_at=folder.created_at,
            children=[],
        )
    return response


@router.delete("/{note_id}/attachment-folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment_folder(
    note_id: int,
    folder_id: int,
    note: Note = Depends(get_owned_note),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AttachmentFolder).where(
            AttachmentFolder.id == folder_id,
            AttachmentFolder.note_id == note_id,
        )
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    parent_id = folder.parent_id

    all_folders = await _load_all_folders(db, note_id)
    all_ids = _get_descendant_ids(all_folders, folder_id)

    # Unfile all attachments in this folder and its descendants
    await db.execute(
        Attachment.__table__.update()
        .where(Attachment.folder_id.in_(all_ids))
        .values(folder_id=None)
    )

    # Re-parent direct children to the deleted folder's parent
    await db.execute(
        AttachmentFolder.__table__.update()
        .where(
            AttachmentFolder.parent_id == folder_id,
            AttachmentFolder.note_id == note_id,
        )
        .values(parent_id=parent_id)
    )

    await db.delete(folder)
    await db.flush()
