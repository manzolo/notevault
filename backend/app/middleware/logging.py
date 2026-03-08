import json
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("notevault.audit")


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    REDACT_PATHS = ["/secrets"]

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # Log request
        path = request.url.path
        method = request.method

        # Don't log body for secret paths
        body_log = None
        if method in ("POST", "PUT", "PATCH"):
            should_redact = any(p in path for p in self.REDACT_PATHS)
            if not should_redact:
                try:
                    body_bytes = await request.body()
                    body_log = body_bytes.decode("utf-8", errors="replace")[:500]
                except Exception:
                    body_log = "[unreadable]"

        response = await call_next(request)

        duration = time.time() - start_time

        log_data = {
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
        }
        if body_log is not None:
            log_data["body_preview"] = body_log

        logger.info(json.dumps(log_data))

        return response
