from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.models.database import Tag, User
from app.schemas.tag import TagCreate, TagResponse
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=List[TagResponse])
async def list_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tag).where(Tag.user_id == current_user.id).order_by(Tag.name)
    )
    return result.scalars().all()


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_data: TagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if tag already exists
    result = await db.execute(
        select(Tag).where(Tag.name == tag_data.name, Tag.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    tag = Tag(name=tag_data.name, user_id=current_user.id)
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag
