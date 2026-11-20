"""Safe file uploads: size limit, real file-type check (magic bytes), random file names.
Security measures:
- File type validated by magic bytes (not client-supplied MIME type)
- Random UUID filenames (never trust client filenames — prevents path traversal)
- Size limit enforced before writing to disk
- Upload directory resolved to absolute path and validated
"""

import hashlib
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile
from ..config import settings

MAGIC = {
    b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
    b"\x89PNG": ("image/png", ".png"),
    b"%PDF": ("application/pdf", ".pdf"),
}

# Maximum filename length from client (for logging only; never used in path)
_MAX_CLIENT_FILENAME = 255

async def save_upload(file: UploadFile, images_only: bool = False) -> tuple[Path, str, int, str]:
    # Read with size limit + 1 byte to detect oversized uploads
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File larger than {settings.max_upload_mb} MB")
    if len(data) == 0:
        raise HTTPException(422, "Empty file uploads are not accepted")
    for sig, (mime, ext) in MAGIC.items():
        if data.startswith(sig):
            if images_only and not mime.startswith("image/"):
                raise HTTPException(415, "Only JPEG or PNG images are accepted here")
            break
    else:
        raise HTTPException(415, "Only JPEG, PNG or PDF files are accepted")
    upload_dir = settings.upload_dir.resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Generate random filename (UUID) — never use client-supplied name
    path = upload_dir / f"{uuid.uuid4().hex}{ext}"
    # Verify the resolved path is inside the upload directory (defense-in-depth)
    if not str(path.resolve()).startswith(str(upload_dir)):
        raise HTTPException(500, "Upload path validation failed")
    path.write_bytes(data)
    return path, mime, len(data), hashlib.sha256(data).hexdigest()
