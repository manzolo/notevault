from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.models.database import User
from app.schemas.user import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    LoginResponse, TotpSetupResponse, TotpEnableRequest,
    TotpDisableRequest, TotpVerifyRequest,
)
from app.security.auth import hash_password, verify_password, create_access_token, verify_token
from app.security.dependencies import get_current_user
from app.security.totp import (
    generate_totp_secret, get_totp_uri,
    verify_totp_code, encrypt_totp_secret, decrypt_totp_secret,
)
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

_PARTIAL_TOKEN_TTL = timedelta(minutes=5)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check username
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    # Check email
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=LoginResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    # Accept username or email in the username field
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.email == credentials.username))
        user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # If TOTP is enabled (both globally and for this user), return a partial challenge token
    if settings.totp_required and user.totp_enabled:
        partial_token = create_access_token(
            {"sub": str(user.id), "partial": True},
            expires_delta=_PARTIAL_TOKEN_TTL,
        )
        return LoginResponse(totp_required=True, partial_token=partial_token)

    token = create_access_token({"sub": str(user.id)})
    return LoginResponse(access_token=token)


@router.post("/totp/verify", response_model=TokenResponse)
async def totp_verify(data: TotpVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a partial token + TOTP code for a full JWT."""
    payload = verify_token(data.partial_token)
    if payload is None or not payload.get("partial"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not user.totp_enabled or user.totp_secret is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid request")

    secret = decrypt_totp_secret(bytes(user.totp_secret))
    if not verify_totp_code(secret, data.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ── TOTP management (requires full authentication) ──────────────────────────

@router.post("/totp/setup", response_model=TotpSetupResponse)
async def totp_setup(current_user: User = Depends(get_current_user)):
    """Generate a new TOTP secret + provisioning URI. Does NOT enable TOTP yet."""
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.username, issuer=settings.app_name)
    return TotpSetupResponse(secret=secret, otpauth_url=uri)


@router.post("/totp/enable", response_model=UserResponse)
async def totp_enable(
    data: TotpEnableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify the first TOTP code and activate 2FA for the account."""
    if not verify_totp_code(data.secret, data.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code")

    current_user.totp_secret = encrypt_totp_secret(data.secret)
    current_user.totp_enabled = True
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/totp/disable", response_model=UserResponse)
async def totp_disable(
    data: TotpDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable TOTP after confirming the account password."""
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    current_user.totp_secret = None
    current_user.totp_enabled = False
    await db.commit()
    await db.refresh(current_user)
    return current_user
