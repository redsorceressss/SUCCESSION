from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ai_engine.voice.parse_rules import parse_entry
from ..database import get_db
from ..deps import require_roles
from ..models import Order, User
from ..schemas import VoiceIn

router = APIRouter(tags=["voice"])

@router.post("/voice/parse")
def parse(
    body: VoiceIn,
    user: User = Depends(require_roles("jeweller")),
    db: Session = Depends(get_db),
):
    """Turn spoken text into a DRAFT entry. Nothing is saved: the user must review and confirm."""
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(422, "text must not be empty")
    names = [
        k.name
        for k in db.scalars(
            select(User).where(User.id.in_(select(Order.karigar_id).where(Order.jeweller_id == user.id)))
        )
    ]
    try:
        draft = parse_entry(text, known_karigars=names)
    except Exception:
        # Draft-only fallback: never persist or mutate; require human review.
        draft = {
            "kind": "issue",
            "fields": {},
            "missing": ["karigar", "weight_g", "karat"],
            "questions": ["Could not reliably parse the voice draft. Please enter details manually."],
            "needs_confirmation": ["all"],
            "confidence": {},
            "source_text": text,
            "note": "Draft only. Nothing was saved; human confirmation is required before any transaction.",
            "readback": None,
        }
    if isinstance(draft, dict):
        draft.setdefault("source_text", text)
        draft.setdefault("note", "Draft only. Nothing was saved; human confirmation is required before any transaction.")
        draft.setdefault("draft_only", True)
        draft.setdefault("requires_human_confirmation", True)
    return draft
