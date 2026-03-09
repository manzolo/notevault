import asyncio
import email as email_lib
import aiofiles

_MAX_TEXT_BYTES = 1_000_000  # 1 MB cap


def _sync_pdf_extract(path: str) -> str | None:
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        parts = []
        total = 0
        for page in reader.pages:
            text = page.extract_text() or ""
            parts.append(text)
            total += len(text)
            if total >= _MAX_TEXT_BYTES:
                break
        return "".join(parts)[:_MAX_TEXT_BYTES] or None
    except Exception:
        return None


def _sync_eml_extract(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            msg = email_lib.message_from_file(f)
        parts = []
        for key in ("From", "To", "Cc", "Subject", "Date"):
            val = msg.get(key)
            if val:
                parts.append(f"{key}: {val}")
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        parts.append(payload.decode("utf-8", errors="replace"))
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                parts.append(payload.decode("utf-8", errors="replace"))
        return "\n".join(parts)[:_MAX_TEXT_BYTES] or None
    except Exception:
        return None


async def extract_text(path: str, mime_type: str) -> str | None:
    if mime_type.startswith("text/") or mime_type in ("application/json", "application/xml"):
        async with aiofiles.open(path, "r", encoding="utf-8", errors="replace") as f:
            content = await f.read()
        return content[:_MAX_TEXT_BYTES] or None
    elif mime_type == "application/pdf":
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_pdf_extract, path)
    elif mime_type == "message/rfc822":
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_eml_extract, path)
    return None
