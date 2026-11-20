from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import PARTY, get_current_user
from ..models import (
    Confirmation, CorrectionRequest, Dispute, Transaction, TransactionVersion, User, utcnow
)
from ..schemas import ConfirmIn, CorrectionIn, DecisionIn, DisputeIn, IssueIn, ReturnIn
from ..services import audit, state
from ..services.common import (
    current_version, dispute_out, get_order, get_tx, is_party, iso, open_dispute,
    other_party_id, require_party, tx_out, version_out
)
from ..services.disputes import create_dispute, notify
from ..services.versioning import add_confirmation, add_version, apply_field, field_value

router = APIRouter(tags=["transactions"])

def _create(db: Session, user: User, kind: str, body, scrap: Decimal) -> dict:
    order = get_order(db, body.order_id)
    require_party(order, user)
    if kind == "issue" and user.id != order.jeweller_id:
        raise HTTPException(403, "Only the jeweller can record a gold issue")
    if body.client_id:
        prior = db.scalar(select(Transaction).where(Transaction.client_id == body.client_id))
        if prior:
            return tx_out(db, prior)
    tx = Transaction(order_id=order.id, kind=kind, created_by=user.id, client_id=body.client_id)
    db.add(tx)
    db.flush()
    v = add_version(
        db,
        tx,
        user.id,
        weight=body.weight_g,
        karat=body.karat,
        scrap=scrap,
        note=body.note,
        reason="Original entry",
    )
    add_confirmation(db, tx.id, v, user.id)
    notify(
        db,
        other_party_id(order, user.id),
        "confirmation_needed",
        f"New {kind} entry #{tx.id} is waiting for your confirmation",
    )
    audit.log(db, user.id, f"{kind}_recorded", "transaction", tx.id, {"version_hash": v.version_hash})
    db.commit()
    return tx_out(db, tx)

@router.post("/transactions/issue", status_code=201)
def issue(body: IssueIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    return _create(db, user, "issue", body, Decimal("0"))

@router.post("/transactions/return", status_code=201)
def record_return(body: ReturnIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    return _create(db, user, "return", body, body.scrap_g)

@router.get("/transactions")
def list_transactions(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = get_order(db, order_id)
    if user.role != "agent":
        require_party(order, user)
    rows = db.scalars(select(Transaction).where(Transaction.order_id == order_id).order_by(Transaction.id))
    return [tx_out(db, t) for t in rows]

@router.get("/transactions/{tx_id}")
def get_transaction(tx_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = get_tx(db, tx_id)
    if user.role != "agent":
        require_party(get_order(db, tx.order_id), user)
    return tx_out(db, tx)

@router.get("/transactions/{tx_id}/history")
def history(tx_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everything that ever happened to this entry. Nothing here is hidden from either party."""
    tx = get_tx(db, tx_id)
    if user.role != "agent":
        require_party(get_order(db, tx.order_id), user)
    versions = db.scalars(
        select(TransactionVersion).where(TransactionVersion.transaction_id == tx.id).order_by(TransactionVersion.version_no)
    )
    confs = db.scalars(
        select(Confirmation).where(Confirmation.transaction_id == tx.id).order_by(Confirmation.id)
    )
    corr = db.scalars(
        select(CorrectionRequest).where(CorrectionRequest.transaction_id == tx.id).order_by(CorrectionRequest.id)
    )
    disputes = db.scalars(select(Dispute).where(Dispute.transaction_id == tx.id).order_by(Dispute.id))
    return {
        "transaction": tx_out(db, tx),
        "versions": [version_out(v) for v in versions],
        "confirmations": [
            {
                "version_no": c.version_no,
                "user_id": c.user_id,
                "version_hash": c.version_hash,
                "at": iso(c.created_at),
            }
            for c in confs
        ],
        "correction_requests": [
            {
                "id": c.id,
                "field": c.field,
                "original": c.original_value,
                "proposed": c.proposed_value,
                "reason": c.reason,
                "requested_by": c.requested_by,
                "status": c.status,
                "decided_by": c.decided_by,
                "decided_at": iso(c.decided_at),
                "resulting_version_no": c.resulting_version_no,
            }
            for c in corr
        ],
        "disputes": [dispute_out(db, d, full=True) for d in disputes],
    }

@router.post("/transactions/{tx_id}/confirm")
def confirm(tx_id: int, body: ConfirmIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    tx = get_tx(db, tx_id)
    order = get_order(db, tx.order_id)
    require_party(order, user)
    if body.version_no != tx.current_version:
        raise HTTPException(409, f"Outdated version. The current version is {tx.current_version}")
    if tx.state not in ("AWAITING_CONFIRMATION",):
        raise HTTPException(409, f"Cannot confirm an entry that is {tx.state}")
    v = current_version(db, tx)
    add_confirmation(db, tx.id, v, user.id)
    from ..services.common import confirmed_user_ids
    if {order.jeweller_id, order.karigar_id} <= confirmed_user_ids(db, tx.id, v.version_no):
        state.move(tx, "CONFIRMED_BY_BOTH")
    audit.log(db, user.id, "confirmed", "transaction", tx.id, {"version_no": v.version_no})
    db.commit()
    return tx_out(db, tx)

@router.post("/transactions/{tx_id}/correction-requests", status_code=201)
def request_correction(
    tx_id: int,
    body: CorrectionIn,
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    tx = get_tx(db, tx_id)
    order = get_order(db, tx.order_id)
    require_party(order, user)
    if open_dispute(db, tx.id):
        raise HTTPException(409, "This entry is disputed; resolve the dispute first")
    if tx.state == "CORRECTION_REQUESTED":
        raise HTTPException(409, "A correction request is already waiting for a decision")
    v = current_version(db, tx)
    apply_field(v, body.field, body.proposed_value)  # validates the proposed value
    cr = CorrectionRequest(
        transaction_id=tx.id,
        base_version_no=v.version_no,
        field=body.field,
        original_value=field_value(v, body.field),
        proposed_value=body.proposed_value,
        reason=body.reason,
        requested_by=user.id,
    )
    db.add(cr)
    state.move(tx, "CORRECTION_REQUESTED")
    db.flush()
    notify(
        db,
        other_party_id(order, user.id),
        "correction_requested",
        f"Correction requested on entry #{tx.id}: {body.field} {cr.original_value} -> {cr.proposed_value}",
    )
    audit.log(db, user.id, "correction_requested", "transaction", tx.id, {"correction_id": cr.id})
    db.commit()
    return {
        "id": cr.id,
        "status": cr.status,
        "field": cr.field,
        "original_value": cr.original_value,
        "proposed_value": cr.proposed_value,
        "transaction": tx_out(db, tx),
    }

@router.post("/correction-requests/{cr_id}/decide")
def decide_correction(
    cr_id: int,
    body: DecisionIn,
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    cr = db.get(CorrectionRequest, cr_id)
    if cr is None:
        raise HTTPException(404, "Correction request not found")
    tx = get_tx(db, cr.transaction_id)
    order = get_order(db, tx.order_id)
    require_party(order, user)
    if cr.status != "PENDING":
        raise HTTPException(409, "Already decided")
    if user.id == cr.requested_by:
        raise HTTPException(403, "The other party must decide on your request")
    cr.decided_by, cr.decided_at, cr.decision_reason = user.id, utcnow(), body.reason
    if body.decision == "accept":
        cr.status = "ACCEPTED"
        vals = apply_field(current_version(db, tx), cr.field, cr.proposed_value)
        v = add_version(
            db,
            tx,
            user.id,
            reason=f"Correction #{cr.id} accepted: {cr.field} {cr.original_value} -> {cr.proposed_value}",
            **vals,
        )
        cr.resulting_version_no = v.version_no
        for uid in (order.jeweller_id, order.karigar_id):
            add_confirmation(db, tx.id, v, uid)
        state.move(tx, "CONFIRMED_BY_BOTH")
    else:
        cr.status = "REJECTED"
        state.move(tx, state.settled_state(db, tx, order))
    audit.log(db, user.id, f"correction_{cr.status.lower()}", "transaction", tx.id, {"correction_id": cr.id})
    db.commit()
    return {"id": cr.id, "status": cr.status, "transaction": tx_out(db, tx)}

@router.post("/transactions/{tx_id}/disputes", status_code=201)
def dispute(tx_id: int, body: DisputeIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    tx = get_tx(db, tx_id)
    d, created, message = create_dispute(
        db,
        user,
        tx,
        body.field,
        body.claimed_value,
        body.reason,
        body.client_id,
        body.evidence_refs,
    )
    db.commit()
    return {**dispute_out(db, d), "created": created, "message": message, "transaction": tx_out(db, tx)}
