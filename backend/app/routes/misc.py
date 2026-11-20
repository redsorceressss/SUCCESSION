"""Notifications, agent-only endpoints, audit verification, health, and AI query."""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import AgentTask, Dispute, Notification, Order, Transaction, User, utcnow
from ..schemas import AgentNotifyIn, AgentTaskIn
from ..services import audit
from ..services.accounts import build_draft
from ..services.common import iso

router = APIRouter(tags=["misc"])

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/notifications")
def my_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc())
    )
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "message": n.message,
            "read": n.read,
            "created_at": iso(n.created_at),
        }
        for n in rows
    ]

@router.get("/audit/verify")
def verify_audit(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ok, bad_id, n = audit.verify(db)
    return {"ok": ok, "first_bad_row": bad_id, "rows_checked": n}

@router.get("/agent/orders")
def agent_orders(user: User = Depends(require_roles("agent")), db: Session = Depends(get_db)):
    """What the agent needs to chase deadlines: no personal details beyond ids."""
    out = []
    for o in db.scalars(select(Order).where(Order.status == "OPEN")):
        draft = build_draft(db, o)
        states = [r.state for r in db.scalars(select(Transaction).where(Transaction.order_id == o.id))]
        has_ret = any(
            t.kind == "return"
            for t in db.scalars(select(Transaction).where(Transaction.order_id == o.id))
        )
        out.append({
            "order_id": o.id,
            "jeweller_id": o.jeweller_id,
            "karigar_id": o.karigar_id,
            "description": o.description,
            "due_date": iso(o.due_date),
            "issued_fine_g": draft["issued_fine_g"],
            "returned_fine_g": draft["returned_fine_g"],
            "pending_entries": sum(s in ("AWAITING_CONFIRMATION", "CORRECTION_REQUESTED") for s in states),
            "disputed_entries": sum(s == "DISPUTED" for s in states),
            "has_return": has_ret,
        })
    return out

@router.get("/agent/disputes")
def agent_disputes(user: User = Depends(require_roles("agent")), db: Session = Depends(get_db)):
    now = utcnow()
    rows = db.scalars(select(Dispute).where(Dispute.state == "OPEN"))
    result = []
    for d in rows:
        tx = db.get(Transaction, d.transaction_id)
        o = db.get(Order, tx.order_id)
        result.append({
            "dispute_id": d.id,
            "order_id": o.id,
            "jeweller_id": o.jeweller_id,
            "karigar_id": o.karigar_id,
            "age_days": (now - d.created_at).days,
        })
    return result

@router.post("/agent/notifications")
def agent_notify(
    body: AgentNotifyIn,
    user: User = Depends(require_roles("agent")),
    db: Session = Depends(get_db),
):
    """Reminders only. dedupe_key stops the agent from sending the same reminder twice."""
    if body.dedupe_key and db.scalar(
        select(Notification).where(
            Notification.user_id == body.user_id,
            Notification.dedupe_key == body.dedupe_key,
        )
    ):
        return {"created": False}
    db.add(Notification(user_id=body.user_id, kind=body.kind, message=body.message, dedupe_key=body.dedupe_key))
    db.commit()
    return {"created": True}

@router.post("/agent/tasks", status_code=201)
def agent_task(
    body: AgentTaskIn,
    user: User = Depends(require_roles("agent")),
    db: Session = Depends(get_db),
):
    t = AgentTask(kind=body.kind, order_id=body.order_id, summary=body.summary)
    db.add(t)
    db.flush()
    audit.log(db, user.id, "agent_task", "agent_task", t.id, {"kind": body.kind, "order_id": body.order_id})
    db.commit()
    return {"id": t.id}


# ---------------------------------------------------------------------------
# AI / Policy Assistant  (POST /ai/query)
# ---------------------------------------------------------------------------

class AIQueryIn(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


def _rag_shop_id(user: User) -> str:
    """Derive a server-side tenant scope for RAG retrieval.

    Never trust client-supplied tenant identifiers. Public policy chunks
    (shop_id is None) remain retrievable for all authenticated users; private
    chunks, if indexed in future, must be scoped to an explicit tenant id.
    """
    return f"tenant:{user.id}"


@router.post("/ai/query")
def ai_query(body: AIQueryIn, user: User = Depends(get_current_user)):
    """
    Policy Assistant powered by the RAG engine.

    Answers questions about SUCCESSION workflows, dispute procedures, settlement
    rules, and gold conservation policies using indexed project documentation.

    - Requires authentication (any role).
    - Tenant/shop context is derived server-side from the authenticated user;
      client-supplied tenant identifiers are never used for authorization.
    - Results are grounded in local documentation — no paid external API calls
      are made unless LLM_BASE_URL and LLM_API_KEY env vars are configured.
    - Adversarial prompt-injection attempts are detected and neutralised.
    - The AI **cannot** approve transactions, settlements, or disputes.
    """
    from ..services.rag_service import query as rag_query
    try:
        result = rag_query(body.question, shop_id=_rag_shop_id(user))
    except Exception:  # pragma: no cover — provider/network/env errors
        raise HTTPException(503, detail="Policy assistant temporarily unavailable.")
    return {
        "question": body.question,
        "answer": result["answer"],
        "sources": result["sources"],
        "citations": result["citations"],
        "grounded": result["grounded"],
        "injection_detected": result["injection_detected"],
        "note": (
            "This assistant explains policies and procedures only. "
            "It cannot approve, modify, or confirm any financial record."
        ),
    }
