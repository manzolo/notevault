import os
import re
import filetype
from fastapi import HTTPException, status

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
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
    # Text / Markdown
    "text/markdown": ".md",
    # Archives
    "application/zip": ".zip",
    "application/x-tar": ".tar",
    "application/gzip": ".gz",
}

# Extensions where the declared extension wins over magic-byte detection.
# These formats are ZIP/OLE containers, so magic bytes alone are ambiguous.
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
    # Plain text / Markdown
    ".md": "text/markdown",
    ".markdown": "text/markdown",
}


def validate(header_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """Detect MIME type. Extension wins for Office/ODF/Markdown (ZIP-based containers).
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
