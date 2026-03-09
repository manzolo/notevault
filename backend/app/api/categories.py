from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from app.database.connection import get_db
from app.models.database import Category, Note, User
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    user_id: int
    parent_id: Optional[int] = None
    updated_at: Optional[datetime] = None
    created_at: datetime
    children: List["CategoryResponse"] = []

    model_config = ConfigDict(from_attributes=True)


CategoryResponse.model_rebuild()


def _build_tree(all_cats: list[Category]) -> list[CategoryResponse]:
    """Build a nested CategoryResponse tree from a flat list of ORM objects."""
    # Map id → CategoryResponse (children still empty)
    nodes: dict[int, CategoryResponse] = {}
    for cat in all_cats:
        nodes[cat.id] = CategoryResponse(
            id=cat.id,
            name=cat.name,
            user_id=cat.user_id,
            parent_id=cat.parent_id,
            updated_at=cat.updated_at,
            created_at=cat.created_at,
            children=[],
        )

    roots: list[CategoryResponse] = []
    for cat in all_cats:
        node = nodes[cat.id]
        if cat.parent_id is None or cat.parent_id not in nodes:
            roots.append(node)
        else:
            nodes[cat.parent_id].children.append(node)

    # Sort each level alphabetically
    def _sort(nodes_list: list[CategoryResponse]) -> None:
        nodes_list.sort(key=lambda n: n.name.lower())
        for n in nodes_list:
            _sort(n.children)

    _sort(roots)
    return roots


async def _load_all_categories(db: AsyncSession, user_id: int) -> list[Category]:
    result = await db.execute(
        select(Category).where(Category.user_id == user_id)
    )
    return list(result.scalars().all())


async def _get_descendant_ids(all_cats: list[Category], category_id: int) -> list[int]:
    """Return category_id plus all descendant IDs via BFS (uses pre-loaded list)."""
    children_map: dict[int, list[int]] = {}
    for cat in all_cats:
        pid = cat.parent_id
        if pid not in children_map:
            children_map[pid] = []
        children_map[pid].append(cat.id)

    ids = [category_id]
    queue = [category_id]
    while queue:
        cur = queue.pop()
        for child_id in children_map.get(cur, []):
            ids.append(child_id)
            queue.append(child_id)
    return ids


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return full category tree (root nodes with nested children)."""
    all_cats = await _load_all_categories(db, current_user.id)
    return _build_tree(all_cats)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate parent ownership if provided
    if category_data.parent_id is not None:
        parent_result = await db.execute(
            select(Category).where(
                Category.id == category_data.parent_id,
                Category.user_id == current_user.id,
            )
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")

    # Check for duplicate name at the same level
    dup_result = await db.execute(
        select(Category).where(
            Category.name == category_data.name,
            Category.user_id == current_user.id,
            Category.parent_id == category_data.parent_id,
        )
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists at this level")

    category = Category(
        name=category_data.name,
        user_id=current_user.id,
        parent_id=category_data.parent_id,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)

    # Return as Pydantic model (children always empty for a new category)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        user_id=category.user_id,
        parent_id=category.parent_id,
        updated_at=category.updated_at,
        created_at=category.created_at,
        children=[],
    )


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category_data.name is not None:
        category.name = category_data.name

    if "parent_id" in category_data.model_fields_set:
        new_parent_id = category_data.parent_id
        if new_parent_id is not None:
            # Validate parent ownership
            parent_result = await db.execute(
                select(Category).where(
                    Category.id == new_parent_id,
                    Category.user_id == current_user.id,
                )
            )
            if not parent_result.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")

            # Prevent circular parenting
            all_cats = await _load_all_categories(db, current_user.id)
            descendant_ids = await _get_descendant_ids(all_cats, category_id)
            if new_parent_id in descendant_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set a descendant as parent (circular reference)",
                )

        category.parent_id = new_parent_id

    await db.flush()
    await db.refresh(category)

    # Load all cats to build correct subtree for this node
    all_cats = await _load_all_categories(db, current_user.id)
    tree = _build_tree(all_cats)

    def _find(nodes: list[CategoryResponse], target_id: int) -> CategoryResponse | None:
        for n in nodes:
            if n.id == target_id:
                return n
            found = _find(n.children, target_id)
            if found:
                return found
        return None

    response = _find(tree, category_id)
    if not response:
        # Fallback: return without children
        return CategoryResponse(
            id=category.id,
            name=category.name,
            user_id=category.user_id,
            parent_id=category.parent_id,
            updated_at=category.updated_at,
            created_at=category.created_at,
            children=[],
        )
    return response


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    parent_id = category.parent_id

    # Get all descendant IDs (including self) to unfile notes
    all_cats = await _load_all_categories(db, current_user.id)
    all_ids = await _get_descendant_ids(all_cats, category_id)

    # Set category_id = NULL for all notes in this folder and descendants
    await db.execute(
        Note.__table__.update()
        .where(Note.category_id.in_(all_ids))
        .values(category_id=None)
    )

    # Re-parent direct children to deleted category's parent
    await db.execute(
        Category.__table__.update()
        .where(
            Category.parent_id == category_id,
            Category.user_id == current_user.id,
        )
        .values(parent_id=parent_id)
    )

    await db.delete(category)
    await db.flush()
