import asyncio
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


async def extract_text(path: str, mime_type: str) -> str | None:
    if mime_type.startswith("text/") or mime_type in ("application/json", "application/xml"):
        async with aiofiles.open(path, "r", encoding="utf-8", errors="replace") as f:
            content = await f.read()
        return content[:_MAX_TEXT_BYTES] or None
    elif mime_type == "application/pdf":
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_pdf_extract, path)
    return None
