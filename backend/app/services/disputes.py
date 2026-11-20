"""Dispute rules: create, note, reweigh, propose/approve resolution, release holds.
Rules you must never break:
 * the original version is never edited;
 * a dispute creates a settlement hold for the disputed quantity;
 * only the OTHER party's approval (a human) can close a dispute: no code path lets the agent do it.
"""

import json
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from core_engine.disputes import split_disputed
from core_engine.purity import fine_gold, q4
from ..models import (
    Dispute, DisputeNote, DisputeResolution, Notification, ReweighRequest,
    SettlementHold, Transaction, User, utcnow
)
from . import audit, state
from .common import (
    current_version, fmt_g, get_order, open_dispute, other_party_id, require_party
)
from .versioning import add_confirmation, add_version, apply_field, field_value

def _held_quantity(field: str, v, claimed_raw: str) -> Decimal:
    """How many grams are in dispute? weight: |50.00-49.85|; karat: difference in FINE gold; else 0."""
    try:
        if field == "weight_g":
            return split_disputed(v.weight_g, Decimal(claimed_raw))[1]
        if field == "karat":
            return q4(abs(fine_gold(v.weight_g, v.karat) - fine_gold(v.weight_g, int(claimed_raw))))
        if field == "scrap_g":
            return q4(abs(v.scrap_g - Decimal(claimed_raw)))
    except Exception:
        raise HTTPException(422, f"'{claimed_raw}' is not a valid value for {field}")
    return Decimal("0")

def notify(db: Session, user_id: int, kind: str, message: str, dedupe_key: str | None = None):
    db.add(Notification(user_id=user_id, kind=kind, message=message, dedupe_key=dedupe_key))

def create_dispute(
    db: Session,
    user: User,
    tx: Transaction,
    field: str,
    claimed: str,
    reason: str,
    client_id: str | None = None,
    evidence_refs: list[str] | None = None,
) -> tuple[Dispute, bool, str]:
    """Returns (dispute, created_now, message). Idempotent on client_id (offline retries)."""
    order = get_order(db, tx.order_id)
    require_party(order, user)
    if client_id:
        existing = db.scalar(select(Dispute).where(Dispute.client_id == client_id))
        if existing:
            return existing, False, "already recorded"
    if open_dispute(db, tx.id):
        raise HTTPException(409, "This entry already has an open dispute")
    v = current_version(db, tx)
    original = field_value(v, field)
    # Compare numerically for numeric fields to avoid format mismatches (e.g. "49.85" vs "49.8500")
    same_value = False
    if field == "note":
        same_value = original == claimed
    elif field == "karat":
        try:
            same_value = int(original) == int(claimed)
        except Exception:
            same_value = original == claimed
    elif field in ("weight_g", "scrap_g"):
        try:
            same_value = q4(Decimal(str(original))) == q4(Decimal(str(claimed)))
        except Exception:
            same_value = original == claimed
    else:
        same_value = original == claimed
    if same_value:
        raise HTTPException(422, "The claimed value is the same as the recorded value")
    held = _held_quantity(field, v, claimed)
    d = Dispute(
        transaction_id=tx.id,
        version_no=v.version_no,
        field=field,
        original_value=original,
        claimed_value=claimed,
        raised_by=user.id,
        reason=reason,
        client_id=client_id,
        evidence_refs=json.dumps(evidence_refs or []),
    )
    db.add(d)
    db.flush()
    db.add(SettlementHold(dispute_id=d.id, transaction_id=tx.id, order_id=order.id, held_g=held))
    state.move(tx, "DISPUTED")

    creator_role = "jeweller" if tx.created_by == order.jeweller_id else "karigar"
    raiser_role = "jeweller" if user.id == order.jeweller_id else "karigar"
    if field == "weight_g":
        db.add(ReweighRequest(dispute_id=d.id, requested_by=user.id, note="Opened with the dispute"))
        message = (
            f"The {creator_role} entered {fmt_g(original)} g. The {raiser_role} reports {fmt_g(claimed)} g. "
            "Entry marked disputed; reweighing requested."
        )
    else:
        message = (
            f"The {creator_role} recorded {field} = {original}. The {raiser_role} reports {claimed}. "
            "Entry marked disputed."
        )
    notify(db, other_party_id(order, user.id), "dispute_opened", message)
    audit.log(
        db,
        user.id,
        "dispute_created",
        "dispute",
        d.id,
        {
            "transaction_id": tx.id,
            "field": field,
            "original": original,
            "claimed": claimed,
            "held_g": str(held),
        },
    )
    return d, True, message

def add_note(db: Session, user: User, d: Dispute, text: str) -> DisputeNote:
    tx = db.get(Transaction, d.transaction_id)
    order = get_order(db, tx.order_id)
    from ..models import AssayerAssignment
    from sqlalchemy import select
    is_party = user.id in (order.jeweller_id, order.karigar_id)
    is_assigned_assayer = False
    if user.role == "assayer" and not is_party:
        is_assigned_assayer = db.scalar(select(AssayerAssignment.id).where(
            AssayerAssignment.dispute_id == d.id,
            AssayerAssignment.assayer_user_id == user.id,
            AssayerAssignment.status == "ACTIVE",
        )) is not None
    if not (is_party or is_assigned_assayer):
        raise HTTPException(403, "You are not authorized to add notes to this dispute")
    note = DisputeNote(dispute_id=d.id, user_id=user.id, text=text)
    db.add(note)
    db.flush()
    audit.log(db, user.id, "dispute_note_added", "dispute", d.id, {"note_id": note.id, "user_role": user.role})
    return note

def propose_resolution(db: Session, user: User, d: Dispute, outcome: str, agreed_value: str | None, note: str):
    tx = db.get(Transaction, d.transaction_id)
    require_party(get_order(db, tx.order_id), user)
    if d.state != "OPEN":
        raise HTTPException(409, "This dispute is already resolved")
    if outcome == "AGREED_VALUE":
        if not agreed_value:
            raise HTTPException(422, "agreed_value is required for AGREED_VALUE")
        apply_field(current_version(db, tx), d.field, agreed_value)  # validates the value
    pending = db.scalar(
        select(DisputeResolution).where(
            DisputeResolution.dispute_id == d.id,
            DisputeResolution.status == "PROPOSED",
        )
    )
    if pending:
        raise HTTPException(409, "A resolution proposal is already waiting for a decision")
    r = DisputeResolution(
        dispute_id=d.id,
        proposed_by=user.id,
        outcome=outcome,
        agreed_value=agreed_value if outcome == "AGREED_VALUE" else None,
        note=note,
    )
    db.add(r)
    db.flush()
    order = get_order(db, tx.order_id)
    notify(
        db,
        other_party_id(order, user.id),
        "resolution_proposed",
        f"Resolution proposed for dispute #{d.id}: {outcome}",
    )
    audit.log(
        db,
        user.id,
        "resolution_proposed",
        "dispute",
        d.id,
        {"resolution_id": r.id, "outcome": outcome},
    )
    return r

def decide_resolution(db: Session, user: User, r: DisputeResolution, decision: str):
    d = db.get(Dispute, r.dispute_id)
    tx = db.get(Transaction, d.transaction_id)
    order = get_order(db, tx.order_id)
    require_party(order, user)
    if r.status != "PROPOSED":
        raise HTTPException(409, "This proposal was already decided")
    if user.id == r.proposed_by:
        raise HTTPException(403, "The other party must decide on your proposal")
    r.decided_by, r.decided_at = user.id, utcnow()
    if decision == "reject":
        r.status = "REJECTED"  # dispute stays OPEN and the hold stays in place
        audit.log(db, user.id, "resolution_rejected", "dispute", d.id, {"resolution_id": r.id})
        return r
    r.status = "APPROVED"
    cur = current_version(db, tx)
    if r.outcome == "AGREED_VALUE":
        vals = apply_field(cur, d.field, r.agreed_value)
        cur = add_version(
            db,
            tx,
            user.id,
            reason=f"Dispute #{d.id} resolved: {d.field} agreed as {r.agreed_value}",
            **vals,
        )
        r.resulting_version_no = cur.version_no
        for uid in (order.jeweller_id, order.karigar_id):  # both agreed, so both confirm the final version
            add_confirmation(db, tx.id, cur, uid)
    for h in db.scalars(select(SettlementHold).where(SettlementHold.dispute_id == d.id)):
        h.released_at = utcnow()
    d.state, d.resolved_at = "RESOLVED", utcnow()
    state.move(tx, "CONFIRMED_BY_BOTH")
    audit.log(
        db,
        user.id,
        "dispute_resolved",
        "dispute",
        d.id,
        {"resolution_id": r.id, "outcome": r.outcome, "version_no": cur.version_no},
    )
    return r
