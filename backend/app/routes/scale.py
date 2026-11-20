"""Scale-Photo Witness: store the photo, read the display, compare with the entered weight."""

from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ai_engine.ocr.compare import compare_weights
from ai_engine.ocr.read_display import read_display
from ..config import settings
from ..database import get_db
from ..deps import PARTY
from ..models import EvidenceFile, User
from ..services import audit
from ..services.common import get_order, get_tx, require_party, s
from ..services.evidence import save_upload

router = APIRouter(tags=["scale-photo"])

@router.post("/scale-photos", status_code=201)
async def scale_photo(
    transaction_id: int = Form(...),
    entered_weight: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    tx = get_tx(db, transaction_id)
    require_party(get_order(db, tx.order_id), user)
    try:
        entered = Decimal(entered_weight)
    except InvalidOperation:
        raise HTTPException(422, "entered_weight must be a number such as 47.10")
    if entered <= 0:
        raise HTTPException(422, "entered_weight must be greater than 0")

    path, mime, size, sha = await save_upload(file, images_only=True)

    try:
        reading = read_display(str(path))
    except Exception:
        # OCR/preprocessing failures must not crash the request or mutate finances.
        # Treat as unreadable and require manual confirmation; evidence is still stored.
        from ai_engine.ocr.read_display import Reading
        reading = Reading(value=None, status="UNREADABLE", confidence=0.0, raw="processing_error")

    ocr_value = getattr(reading, "value", None)
    try:
        status = compare_weights(ocr_value, entered, settings.scale_match_g)
    except Exception:
        status = "UNREADABLE"
    if status not in {"MATCH", "MISMATCH", "UNREADABLE"}:
        status = "UNREADABLE"

    ev = EvidenceFile(
        transaction_id=tx.id,
        uploader_id=user.id,
        path=str(path),
        mime=mime,
        size_bytes=size,
        sha256=sha,
        kind="scale_photo",
        entered_weight=entered,
        ocr_reading=ocr_value,
        ocr_status=status,
    )
    db.add(ev)
    db.flush()
    audit.log(
        db,
        user.id,
        "scale_photo_added",
        "transaction",
        tx.id,
        {"evidence_id": ev.id, "status": status},
    )
    db.commit()
    return {
        "evidence_id": ev.id,
        "uploaded_at": ev.created_at.isoformat(),
        "sha256": sha,
        "ocr_reading_g": s(ocr_value),
        "entered_g": s(entered),
        "status": status,
        "needs_manual_confirm": status != "MATCH",
        "disclaimer": "SIMPLIFIED reading. It shows what the scale displayed, not the gold's purity.",
    }
