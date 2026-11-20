"""Small helpers used by many routes: lookups, permission checks, JSON serializers."""

import json
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from core_engine.purity import q4
from ..models import (Confirmation, Dispute, Order, Transaction, TransactionVersion, User)

def fmt_g(x) -> str:
    """Display grams with at least 2 decimals, trimming useless zeros: 50 -> '50.00', 0.15 -> '0.15'."""
    s = format(Decimal(str(x)).normalize(), "f")
    if "." not in s:
        return s + ".00"
    whole, frac = s.split(".")
    return f"{whole}.{frac.ljust(2, '0')}"

def s(x):
    """Decimal -> str so JSON never contains floats (FastAPI would turn raw Decimals into floats!)."""
    return None if x is None else str(x)

def iso(dt):
    return dt.isoformat() if dt else None

def get_tx(db: Session, tx_id: int) -> Transaction:
    tx = db.get(Transaction, tx_id)
    if tx is None:
        raise HTTPException(404, "Transaction not found")
    return tx

def get_order(db: Session, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return order

def get_dispute(db: Session, dispute_id: int) -> Dispute:
    d = db.get(Dispute, dispute_id)
    if d is None:
        raise HTTPException(404, "Dispute not found")
    return d

def is_party(order: Order, user: User) -> bool:
    return user.id in (order.jeweller_id, order.karigar_id)

def require_party(order: Order, user: User) -> None:
    """Only the jeweller or karigar of THIS order may see or change its records."""
    if not is_party(order, user):
        raise HTTPException(403, "You are not a party to this order")

def other_party_id(order: Order, user_id: int) -> int:
    return order.karigar_id if user_id == order.jeweller_id else order.jeweller_id

def version_of(db: Session, tx_id: int, version_no: int) -> TransactionVersion:
    v = db.scalar(
        select(TransactionVersion).where(
            TransactionVersion.transaction_id == tx_id,
            TransactionVersion.version_no == version_no,
        )
    )
    if v is None:
        raise HTTPException(404, "Version not found")
    return v

def current_version(db: Session, tx: Transaction) -> TransactionVersion:
    return version_of(db, tx.id, tx.current_version)

def confirmed_user_ids(db: Session, tx_id: int, version_no: int) -> set[int]:
    rows = db.scalars(
        select(Confirmation.user_id).where(
            Confirmation.transaction_id == tx_id,
            Confirmation.version_no == version_no,
        )
    )
    return set(rows)

def open_dispute(db: Session, tx_id: int) -> Dispute | None:
    return db.scalar(select(Dispute).where(Dispute.transaction_id == tx_id, Dispute.state == "OPEN"))

# ---- serializers -------------------------------------------------------------------------

def version_out(v: TransactionVersion) -> dict:
    return {
        "version_no": v.version_no,
        "weight_g": s(v.weight_g),
        "karat": v.karat,
        "fine_g": s(v.fine_g),
        "scrap_g": s(v.scrap_g),
        "note": v.note,
        "reason": v.reason,
        "created_by": v.created_by,
        "prev_hash": v.prev_hash,
        "version_hash": v.version_hash,
        "created_at": iso(v.created_at),
    }

def tx_out(db: Session, tx: Transaction) -> dict:
    v = current_version(db, tx)
    od = open_dispute(db, tx.id)
    return {
        "id": tx.id,
        "order_id": tx.order_id,
        "kind": tx.kind,
        "state": tx.state,
        "created_by": tx.created_by,
        "current_version": version_out(v),
        "open_dispute_id": od.id if od else None,
        "created_at": iso(tx.created_at),
    }

def dispute_out(db: Session, d: Dispute, full: bool = False) -> dict:
    from ..models import DisputeNote, EvidenceFile, ReweighRequest, DisputeResolution, SettlementHold

    out = {
        "id": d.id,
        "transaction_id": d.transaction_id,
        "version_no": d.version_no,
        "field": d.field,
        "original_value": d.original_value,
        "claimed_value": d.claimed_value,
        "raised_by": d.raised_by,
        "reason": d.reason,
        "state": d.state,
        "created_at": iso(d.created_at),
        "resolved_at": iso(d.resolved_at),
        "evidence_refs": json.loads(d.evidence_refs),
    }
    holds = db.scalars(select(SettlementHold).where(SettlementHold.dispute_id == d.id)).all()
    out["held_g"] = s(q4(sum((h.held_g for h in holds if h.released_at is None), Decimal("0"))))
    out["hold_released"] = bool(holds) and all(h.released_at for h in holds)
    if full:
        out["notes"] = [
            {"id": n.id, "user_id": n.user_id, "text": n.text, "created_at": iso(n.created_at)}
            for n in db.scalars(select(DisputeNote).where(DisputeNote.dispute_id == d.id))
        ]
        out["evidence"] = [
            {
                "id": e.id,
                "uploader_id": e.uploader_id,
                "sha256": e.sha256,
                "mime": e.mime,
                "created_at": iso(e.created_at),
            }
            for e in db.scalars(select(EvidenceFile).where(EvidenceFile.dispute_id == d.id))
        ]
        out["reweigh_requests"] = [
            {
                "id": r.id,
                "requested_by": r.requested_by,
                "note": r.note,
                "status": r.status,
                "result_weight_g": s(r.result_weight_g),
                "assayer_verified": r.assayer_verified,
                "assayer_user_id": r.assayer_user_id,
            }
            for r in db.scalars(select(ReweighRequest).where(ReweighRequest.dispute_id == d.id))
        ]
        out["resolutions"] = [
            {
                "id": r.id,
                "proposed_by": r.proposed_by,
                "outcome": r.outcome,
                "agreed_value": r.agreed_value,
                "note": r.note,
                "status": r.status,
                "decided_by": r.decided_by,
                "decided_at": iso(r.decided_at),
                "resulting_version_no": r.resulting_version_no,
            }
            for r in db.scalars(select(DisputeResolution).where(DisputeResolution.dispute_id == d.id))
        ]
    return out
