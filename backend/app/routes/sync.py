"""Offline queue upload. Each item carries an idempotency key, so a retry never duplicates anything."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import PARTY
from ..models import SyncRecord, User
from ..schemas import SyncIn
from ..services.common import get_dispute, get_tx
from ..services.disputes import add_note, create_dispute

router = APIRouter(tags=["sync"])

def _apply(db: Session, user: User, kind: str, p: dict) -> dict:
    if kind == "dispute_create":
        d, created, message = create_dispute(
            db,
            user,
            get_tx(db, int(p["transaction_id"])),
            p["field"],
            str(p["claimed_value"]),
            p.get("reason", ""),
            client_id=p.get("client_id"),
            evidence_refs=p.get("evidence_refs", []),
        )
        return {"dispute_id": d.id, "created": created, "message": message}
    n = add_note(db, user, get_dispute(db, int(p["dispute_id"])), p["text"])
    return {"note_id": n.id}

@router.post("/sync")
def sync(body: SyncIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    results = []
    for item in body.items:
        # Check global key uniqueness and verify ownership
        prior = db.scalar(select(SyncRecord).where(SyncRecord.idempotency_key == item.idempotency_key))
        if prior:
            if prior.user_id != user.id:
                results.append({
                    "idempotency_key": item.idempotency_key,
                    "status": "conflict",
                    "detail": "Idempotency key belongs to another user account",
                })
                continue
            # Exactly same user replaying their own operation: return idempotent result
            results.append({
                "idempotency_key": item.idempotency_key,
                "status": "duplicate",
                "result": json.loads(prior.result_json),
            })
            continue

        try:
            result = _apply(db, user, item.kind, item.payload)
            db.add(
                SyncRecord(
                    idempotency_key=item.idempotency_key,
                    user_id=user.id,
                    kind=item.kind,
                    result_json=json.dumps(result),
                )
            )
            db.commit()
            results.append({"idempotency_key": item.idempotency_key, "status": "accepted", "result": result})
        except IntegrityError:
            # Race condition / concurrent submission of the exact same key: rollback and re-fetch
            db.rollback()
            existing = db.scalar(select(SyncRecord).where(SyncRecord.idempotency_key == item.idempotency_key))
            if existing and existing.user_id == user.id:
                results.append({
                    "idempotency_key": item.idempotency_key,
                    "status": "duplicate",
                    "result": json.loads(existing.result_json),
                })
            else:
                results.append({
                    "idempotency_key": item.idempotency_key,
                    "status": "conflict",
                    "detail": "Concurrent submission collision",
                })
        except HTTPException as e:  # a rule said no: report, keep going
            db.rollback()
            results.append({"idempotency_key": item.idempotency_key, "status": "conflict", "detail": e.detail})
        except (KeyError, ValueError) as e:
            db.rollback()
            results.append({"idempotency_key": item.idempotency_key, "status": "error", "detail": f"bad item: {e}"})
    return {"results": results}
