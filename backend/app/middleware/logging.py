import json
import logging
import time

logger = logging.getLogger("notevault.audit")


class AuditLoggingMiddleware:
    """Pure ASGI middleware for audit logging.

    Uses the raw ASGI interface (scope/receive/send) instead of
    BaseHTTPMiddleware to avoid Starlette's buffered receive channel, which
    corrupts python-multipart's streaming parser for large file uploads.
    """

    REDACT_PATHS = ["/secrets"]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        path = scope.get("path", "")
        method = scope.get("method", "")

        # Parse content-type from ASGI scope headers
        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        content_type = headers.get(b"content-type", b"").decode("utf-8", errors="replace")

        body_log = None
        receive_to_use = receive

        if method in ("POST", "PUT", "PATCH"):
            if "multipart/form-data" in content_type:
                # Don't touch the receive channel — multipart streams must pass through intact
                body_log = "[file upload]"
            elif not any(p in path for p in self.REDACT_PATHS):
                # Buffer body so we can log a preview without losing it for the endpoint
                body_chunks: list[bytes] = []
                more_body = True
                while more_body:
                    message = await receive()
                    if message["type"] == "http.request":
                        body_chunks.append(message.get("body", b""))
                        more_body = message.get("more_body", False)
                    else:
                        # Disconnect or other message — stop reading
                        break
                full_body = b"".join(body_chunks)
                body_log = full_body.decode("utf-8", errors="replace")[:500]

                # Reconstruct a receive coroutine that replays the buffered body
                body_consumed = False

                async def _buffered_receive():
                    nonlocal body_consumed
                    if not body_consumed:
                        body_consumed = True
                        return {"type": "http.request", "body": full_body, "more_body": False}
                    # After the body, delegate to the real receive (e.g. disconnect events)
                    return await receive()

                receive_to_use = _buffered_receive

        # Wrap send to capture the response status code
        status_code: list[int] = [0]

        async def _send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code[0] = message.get("status", 0)
            await send(message)

        await self.app(scope, receive_to_use, _send_wrapper)

        duration = time.time() - start_time
        log_data: dict = {
            "method": method,
            "path": path,
            "status_code": status_code[0],
            "duration_ms": round(duration * 1000, 2),
        }
        if body_log is not None:
            log_data["body_preview"] = body_log

        logger.info(json.dumps(log_data))
