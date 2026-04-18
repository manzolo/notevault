from fastapi import Request
from slowapi import Limiter
from app.security.auth import verify_token


def _client_ip(request: Request) -> str:
    """Real client IP, honouring X-Forwarded-For set by a trusted reverse proxy."""
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _user_id_key(request: Request) -> str:
    """Rate-limit key: user ID from JWT Bearer token, fallback to real client IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = verify_token(auth[7:])
        if payload and "sub" in payload:
            return f"user:{payload['sub']}"
    return _client_ip(request)


# Single application-wide limiter keyed by authenticated user ID
limiter = Limiter(key_func=_user_id_key)
