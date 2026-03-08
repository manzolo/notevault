import os
import re
import filetype
from fastapi import HTTPException, status

ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    # Video
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    # Documents
    "application/pdf": ".pdf",
    # OpenDocument
    "application/vnd.oasis.opendocument.text": ".odt",
    "application/vnd.oasis.opendocument.spreadsheet": ".ods",
    "application/vnd.oasis.opendocument.presentation": ".odp",
    # Microsoft Office (Open XML — ZIP-based, extension wins)
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    # Microsoft Office (legacy binary)
    "application/msword": ".doc",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.ms-powerpoint": ".ppt",
    # Text / Markup / Data (no magic bytes — extension-priority)
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "text/html": ".html",
    "text/xml": ".xml",
    "application/xml": ".xml",
    "application/json": ".json",
    # Archives
    "application/zip": ".zip",
    "application/x-tar": ".tar",
    "application/gzip": ".gz",
}

# Extensions where the declared extension wins over magic-byte detection.
# Covers: Office/ODF containers (ZIP/OLE-based) and all text formats (no magic bytes).
EXTENSION_PRIORITY: dict[str, str] = {
    # OpenDocument
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    # Office Open XML
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Legacy Office
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    # Text / Markup / Data
    ".txt": "text/plain",
    ".log": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
    ".xml": "text/xml",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    # Source / config files (treated as plain text)
    ".py": "text/plain",
    ".js": "text/plain",
    ".ts": "text/plain",
    ".css": "text/plain",
    ".sh": "text/plain",
    ".yaml": "text/plain",
    ".yml": "text/plain",
    ".toml": "text/plain",
    ".ini": "text/plain",
    ".sql": "text/plain",
    ".env": "text/plain",
}


def validate(header_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """Detect MIME type. Extension wins for Office/ODF/text formats.
    Returns (mime_type, extension) or raises HTTPException(415)."""
    ext = os.path.splitext(original_filename)[1].lower()

    # Extension-priority formats: trust the declared extension
    if ext in EXTENSION_PRIORITY:
        mime = EXTENSION_PRIORITY[ext]
        if mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file type: {ext}",
            )
        return mime, ext

    # All other types: detect by magic bytes
    kind = filetype.guess(header_bytes)
    if kind is not None:
        mime = kind.mime
        if mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file type: {mime}",
            )
        return mime, ALLOWED_MIME_TYPES[mime]

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Unsupported file type",
    )


def sanitize_filename(name: str) -> str:
    """Strip path separators and limit to 200 characters."""
    name = os.path.basename(name)
    name = re.sub(r'[^\w\s.\-]', '_', name)
    return name[:200]
