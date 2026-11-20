"""Order summaries, the passbook and the settlement draft. All gold maths is done by core_engine."""

import hashlib
import json
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from core_engine.conservation import reconcile
from core_engine.disputes import split_disputed
from core_engine.purity import q4
from ..config import settings
from ..models import Dispute, Order, SettlementHold, Transaction
from .common import current_version, fmt_g, iso, s, tx_out

def order_transactions(db: Session, order_id: int) -> list[Transaction]:
    return list(db.scalars(select(Transaction).where(Transaction.order_id == order_id).order_by(Transaction.id)))

def open_holds(db: Session, order_id: int) -> list[SettlementHold]:
    return list(
        db.scalars(
            select(SettlementHold).where(
                SettlementHold.order_id == order_id,
                SettlementHold.released_at.is_(None),
            )
        )
    )

def build_draft(db: Session, order: Order) -> dict:
    """Settlement draft. Only entries CONFIRMED BY BOTH count; everything else is listed as excluded."""
    included, excluded = [], []
    issued = returned = scrap = Decimal("0")
    for tx in order_transactions(db, order.id):
        v = current_version(db, tx)
        row = {
            "transaction_id": tx.id,
            "kind": tx.kind,
            "version_no": v.version_no,
            "weight_g": s(v.weight_g),
            "karat": v.karat,
            "fine_g": s(v.fine_g),
        }
        if tx.state == "CONFIRMED_BY_BOTH":
            included.append(row)
            if tx.kind == "issue":
                issued += v.fine_g
            else:
                returned += v.fine_g
                scrap += v.scrap_g
        else:
            row.update(state=tx.state, reason=f"Not settled: entry is {tx.state}")
            excluded.append(row)

    holds = open_holds(db, order.id)
    for h in holds:
        d = db.get(Dispute, h.dispute_id)
        for row in excluded:
            if row["transaction_id"] == h.transaction_id:
                row["held_g"] = s(q4(h.held_g))
                row["dispute_id"] = d.id
                if d.field == "weight_g":
                    row["undisputed_g"] = s(split_disputed(d.original_value, d.claimed_value)[0])

    rec = reconcile(issued, returned, order.wastage_pct, scrap, settings.tolerance_g)
    held_total = sum((h.held_g for h in holds), Decimal("0"))
    draft = {
        "order_id": order.id,
        "included": included,
        "excluded": excluded,
        "issued_fine_g": s(issued),
        "returned_fine_g": s(returned),
        "recovered_scrap_fine_g": s(scrap),
        "wastage_pct": s(order.wastage_pct),
        "reconciliation": {
            "agreed_wastage_g": s(rec.agreed_wastage),
            "gap_to_explain_g": s(rec.gap_to_explain),
            "unexplained_gap_g": s(rec.unexplained_gap),
            "status": rec.status,
            "lines": rec.lines,
        },
        "held_g_total": s(q4(held_total)),
        "has_holds": bool(holds),
        "notes": [
            "Disputed quantities are held and are NOT part of these figures.",
            "Refiner assay values are simulated in the prototype.",
            "Payment amounts are not computed in the prototype.",
        ],
    }
    return draft

def fingerprint(draft: dict) -> str:
    """Changes whenever a confirmed entry, a version or a hold changes, so stale drafts are detected."""
    basis = {
        "inc": [(r["transaction_id"], r["version_no"]) for r in draft["included"]],
        "exc": [(r["transaction_id"], r["version_no"], r.get("dispute_id")) for r in draft["excluded"]],
        "holds": draft["held_g_total"],
    }
    return hashlib.sha256(json.dumps(basis, sort_keys=True).encode()).hexdigest()

def passbook(db: Session, karigar_id: int, jeweller_id: int | None) -> dict:
    """Bank-style account for one karigar (optionally limited to one jeweller's orders)."""
    q = select(Order).where(Order.karigar_id == karigar_id)
    if jeweller_id:
        q = q.where(Order.jeweller_id == jeweller_id)
    orders = list(db.scalars(q))
    issued = returned = scrap = held = Decimal("0")
    entries, pending, disputed = [], [], []
    for o in orders:
        for tx in order_transactions(db, o.id):
            v = current_version(db, tx)
            entries.append(
                {
                    "transaction_id": tx.id,
                    "order_id": o.id,
                    "kind": tx.kind,
                    "state": tx.state,
                    "version_no": v.version_no,
                    "weight_g": s(v.weight_g),
                    "karat": v.karat,
                    "fine_g": s(v.fine_g),
                    "created_at": iso(tx.created_at),
                }
            )
            if tx.state == "CONFIRMED_BY_BOTH":
                if tx.kind == "issue":
                    issued += v.fine_g
                else:
                    returned += v.fine_g
                    scrap += v.scrap_g
            elif tx.state in ("AWAITING_CONFIRMATION", "CORRECTION_REQUESTED"):
                pending.append(tx.id)
            elif tx.state == "DISPUTED":
                disputed.append(tx.id)
        held += sum((h.held_g for h in open_holds(db, o.id)), Decimal("0"))
    return {
        "karigar_id": karigar_id,
        "totals": {
            "issued_fine_g": s(issued),
            "returned_fine_g": s(returned),
            "recovered_scrap_fine_g": s(scrap),
            "gold_in_hand_fine_g": s(issued - returned),
            "held_in_dispute_g": s(q4(held)),
        },
        "pending_confirmations": pending,
        "disputed_entries": disputed,
        "orders": [
            {"id": o.id, "description": o.description, "due_date": iso(o.due_date), "status": o.status}
            for o in orders
        ],
        "entries": entries,
        "spoken_summary": (
            f"You hold {fmt_g(issued - returned)} grams of fine gold. "
            f"{len(pending)} entries are waiting for confirmation, {len(disputed)} are disputed."
        ),
        "not_yet_available": ["payments_due", "payments_made"],
    }
