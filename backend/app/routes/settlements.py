import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import PARTY, get_current_user, require_roles
from ..models import Settlement, SettlementApproval, User
from ..schemas import ApproveIn, RejectIn, SettlementIn
from ..services import audit
from ..services.accounts import build_draft, fingerprint
from ..services.common import get_order, iso, require_party
from ..services.disputes import notify

router = APIRouter(tags=["settlements"])

def settlement_out(db: Session, st: Settlement) -> dict:
    approvals = db.scalars(select(SettlementApproval).where(SettlementApproval.settlement_id == st.id))
    return {
        "id": st.id,
        "order_id": st.order_id,
        "state": st.state,
        "partial": st.partial,
        "created_by": st.created_by,
        "created_at": iso(st.created_at),
        "draft": json.loads(st.draft_json),
        "approvals": [
            {
                "user_id": a.user_id,
                "decision": a.decision,
                "accept_partial": a.accept_partial,
            }
            for a in approvals
        ],
    }

def _load(db: Session, sid: int, user: User) -> Settlement:
    st = db.get(Settlement, sid)
    if st is None:
        raise HTTPException(404, "Settlement not found")
    order = get_order(db, st.order_id)
    if user.role != "agent":
        require_party(order, user)
    return st

@router.post("/settlements", status_code=201)
def create(
    body: SettlementIn,
    user: User = Depends(require_roles("jeweller", "agent")),
    db: Session = Depends(get_db),
):
    """The agent may DRAFT a settlement. Drafting changes nothing about gold balances."""
    order = get_order(db, body.order_id)
    if user.role == "jeweller":
        require_party(order, user)
    draft = build_draft(db, order)
    st = Settlement(
        order_id=order.id,
        created_by=user.id,
        draft_json=json.dumps(draft),
        fingerprint=fingerprint(draft),
    )
    db.add(st)
    db.flush()
    notify(db, order.karigar_id, "settlement_draft", f"A settlement draft for order #{order.id} is ready to review")
    notify(db, order.jeweller_id, "settlement_draft", f"A settlement draft for order #{order.id} is ready to review")
    audit.log(db, user.id, "settlement_drafted", "settlement", st.id, {"order_id": order.id})
    db.commit()
    return settlement_out(db, st)

@router.get("/settlements")
def list_for_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = get_order(db, order_id)
    if user.role != "agent":
        require_party(order, user)
    return [
        settlement_out(db, st)
        for st in db.scalars(select(Settlement).where(Settlement.order_id == order_id))
    ]

@router.get("/settlements/{sid}")
def get_one(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return settlement_out(db, _load(db, sid, user))

@router.post("/settlements/{sid}/approve")
def approve(sid: int, body: ApproveIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    """Human approvals only (PARTY excludes the agent role). Both parties must approve."""
    st = _load(db, sid, user)
    order = get_order(db, st.order_id)
    if st.state != "DRAFT":
        raise HTTPException(409, f"Settlement is already {st.state}")
    fresh = build_draft(db, order)
    if fingerprint(fresh) != st.fingerprint:
        raise HTTPException(409, "The accounts changed after this draft was made. Create a new draft.")
    if fresh["has_holds"] and not body.accept_partial:
        raise HTTPException(
            409,
            "Part of this order is in dispute and held. Approve only as a partial settlement "
            "(accept_partial=true); the held quantity stays out of the settlement.",
        )
    if db.scalar(
        select(SettlementApproval).where(
            SettlementApproval.settlement_id == st.id,
            SettlementApproval.user_id == user.id,
        )
    ):
        raise HTTPException(409, "You already decided on this settlement")
    db.add(
        SettlementApproval(
            settlement_id=st.id,
            user_id=user.id,
            decision="APPROVE",
            accept_partial=body.accept_partial,
        )
    )
    db.flush()
    approved = {
        a.user_id
        for a in db.scalars(
            select(SettlementApproval).where(
                SettlementApproval.settlement_id == st.id,
                SettlementApproval.decision == "APPROVE",
            )
        )
    }
    if {order.jeweller_id, order.karigar_id} <= approved:
        st.state, st.partial = "APPROVED", fresh["has_holds"]
        audit.log(db, user.id, "settlement_approved", "settlement", st.id, {"state": st.state})
    db.commit()
    return settlement_out(db, st)

@router.post("/settlements/{sid}/reject")
def reject(sid: int, body: RejectIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    st = _load(db, sid, user)
    if st.state != "DRAFT":
        raise HTTPException(409, f"Settlement is already {st.state}")
    db.add(
        SettlementApproval(
            settlement_id=st.id,
            user_id=user.id,
            decision="REJECT",
            reason=body.reason,
        )
    )
    st.state = "REJECTED"
    audit.log(db, user.id, "settlement_rejected", "settlement", st.id, {"reason": body.reason})
    db.commit()
    return settlement_out(db, st)
