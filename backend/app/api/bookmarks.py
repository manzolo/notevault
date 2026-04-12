from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.database import Bookmark, BookmarkTag, Note, Tag, User
from app.schemas.bookmark import BookmarkCreate, BookmarkResponse, BookmarkUpdate
from app.security.dependencies import get_current_user


class ReorderItem(BaseModel):
    id: int
    position: int

router = APIRouter(prefix="/api/notes", tags=["bookmarks"])


async def _get_owned_note(note_id: int, user: User, db: AsyncSession) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


async def _get_bookmark(bookmark_id: int, note_id: int, db: AsyncSession) -> Bookmark:
    result = await db.execute(
        select(Bookmark)
        .options(selectinload(Bookmark.tags))
        .where(Bookmark.id == bookmark_id, Bookmark.note_id == note_id)
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    return bookmark


@router.post(
    "/{note_id}/bookmarks",
    response_model=BookmarkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bookmark(
    note_id: int,
    body: BookmarkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)

    bookmark = Bookmark(
        note_id=note_id,
        url=body.url,
        title=body.title,
        description=body.description,
    )
    db.add(bookmark)
    await db.flush()

    # Attach tags (validate ownership)
    if body.tag_ids:
        owned_tags_result = await db.execute(
            select(Tag).where(Tag.id.in_(body.tag_ids), Tag.user_id == current_user.id)
        )
        owned_tag_ids = {t.id for t in owned_tags_result.scalars().all()}
        for tid in body.tag_ids:
            if tid in owned_tag_ids:
                db.add(BookmarkTag(bookmark_id=bookmark.id, tag_id=tid))

    await db.flush()

    result = await db.execute(
        select(Bookmark)
        .options(selectinload(Bookmark.tags))
        .where(Bookmark.id == bookmark.id)
    )
    return result.scalar_one()


@router.get("/{note_id}/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(
    note_id: int,
    include_archived: bool = Query(False),
    archived_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    q = (
        select(Bookmark)
        .options(selectinload(Bookmark.tags))
        .where(Bookmark.note_id == note_id)
    )
    if archived_only:
        q = q.where(Bookmark.is_archived == True)  # noqa: E712
    elif not include_archived:
        q = q.where(Bookmark.is_archived == False)  # noqa: E712
    result = await db.execute(q.order_by(Bookmark.position, Bookmark.created_at.asc()))
    return result.scalars().all()


@router.patch("/{note_id}/bookmarks/reorder", status_code=status.HTTP_200_OK)
async def reorder_bookmarks(
    note_id: int,
    items: List[ReorderItem],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    for item in items:
        await db.execute(
            update(Bookmark)
            .where(Bookmark.id == item.id, Bookmark.note_id == note_id)
            .values(position=item.position)
        )
    await db.commit()
    return {"ok": True}


@router.put("/{note_id}/bookmarks/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(
    note_id: int,
    bookmark_id: int,
    body: BookmarkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    bookmark = await _get_bookmark(bookmark_id, note_id, db)

    if body.url is not None:
        bookmark.url = body.url
    if body.title is not None:
        bookmark.title = body.title
    if body.description is not None:
        bookmark.description = body.description
    if body.is_archived is not None:
        bookmark.is_archived = body.is_archived
        bookmark.archive_note = body.archive_note if body.is_archived else None

    if body.tag_ids is not None:
        # Delete existing tags
        existing_result = await db.execute(
            select(BookmarkTag).where(BookmarkTag.bookmark_id == bookmark.id)
        )
        for bt in existing_result.scalars().all():
            await db.delete(bt)

        # Validate and insert new tags
        if body.tag_ids:
            owned_tags_result = await db.execute(
                select(Tag).where(Tag.id.in_(body.tag_ids), Tag.user_id == current_user.id)
            )
            owned_tag_ids = {t.id for t in owned_tags_result.scalars().all()}
            for tid in body.tag_ids:
                if tid in owned_tag_ids:
                    db.add(BookmarkTag(bookmark_id=bookmark.id, tag_id=tid))

    await db.flush()

    # Reload with updated tags (populate_existing bypasses identity-map cache)
    result = await db.execute(
        select(Bookmark)
        .options(selectinload(Bookmark.tags))
        .where(Bookmark.id == bookmark.id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.delete("/{note_id}/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    note_id: int,
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_note(note_id, current_user, db)
    bookmark = await _get_bookmark(bookmark_id, note_id, db)
    await db.delete(bookmark)
