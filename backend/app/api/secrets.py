from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.models.database import Note, Secret, SecretAccessLog, User
from app.models.enums import AuditAction
from app.schemas.secret import SecretCreate, SecretResponse, SecretRevealResponse
from app.security.dependencies import get_current_user
from app.security.encryption import get_encryption
from app.security.rate_limit import limiter

router = APIRouter(prefix="/api/notes", tags=["secrets"])


@router.get("/{note_id}/secrets", response_model=List[SecretResponse])
async def list_secrets(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify note ownership
    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    result = await db.execute(
        select(Secret).where(Secret.note_id == note_id)
    )
    return result.scalars().all()


@router.post("/{note_id}/secrets", response_model=SecretResponse, status_code=status.HTTP_201_CREATED)
async def create_secret(
    note_id: int,
    secret_data: SecretCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    enc = get_encryption()
    encrypted_value = enc.encrypt(secret_data.value)

    secret = Secret(
        name=secret_data.name,
        secret_type=secret_data.secret_type,
        username=secret_data.username or None,
        encrypted_value=encrypted_value,
        note_id=note_id,
    )
    db.add(secret)
    await db.flush()

    # Log creation
    log = SecretAccessLog(
        secret_id=secret.id,
        user_id=current_user.id,
        action=AuditAction.SECRET_CREATE,
    )
    db.add(log)

    await db.flush()
    await db.refresh(secret)
    return secret


@router.get("/{note_id}/secrets/{secret_id}", response_model=SecretResponse)
async def get_secret(
    note_id: int,
    secret_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    result = await db.execute(
        select(Secret).where(Secret.id == secret_id, Secret.note_id == note_id)
    )
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")
    return secret


@router.post("/{note_id}/secrets/{secret_id}/reveal", response_model=SecretRevealResponse)
@limiter.limit("5/minute")
async def reveal_secret(
    note_id: int,
    secret_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    result = await db.execute(
        select(Secret).where(Secret.id == secret_id, Secret.note_id == note_id)
    )
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")

    enc = get_encryption()
    decrypted_value = enc.decrypt(bytes(secret.encrypted_value))

    # Log the reveal
    log = SecretAccessLog(
        secret_id=secret.id,
        user_id=current_user.id,
        action=AuditAction.SECRET_REVEAL,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(log)

    return SecretRevealResponse(
        id=secret.id,
        name=secret.name,
        secret_type=secret.secret_type,
        username=secret.username,
        value=decrypted_value,
        note_id=secret.note_id,
    )


@router.delete("/{note_id}/secrets/{secret_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_secret(
    note_id: int,
    secret_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    result = await db.execute(
        select(Secret).where(Secret.id == secret_id, Secret.note_id == note_id)
    )
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")

    # Log deletion
    log = SecretAccessLog(
        secret_id=secret.id,
        user_id=current_user.id,
        action=AuditAction.SECRET_DELETE,
    )
    db.add(log)

    await db.delete(secret)
