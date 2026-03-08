from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.security.auth import verify_token


def _user_id_key(request: Request) -> str:
    """Rate-limit key: user ID from JWT Bearer token, fallback to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = verify_token(auth[7:])
        if payload and "sub" in payload:
            return f"user:{payload['sub']}"
    return get_remote_address(request)


# Single application-wide limiter keyed by authenticated user ID
limiter = Limiter(key_func=_user_id_key)
