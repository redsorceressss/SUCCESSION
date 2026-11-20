from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Order, User
from ..schemas import OrderIn
from ..services import audit
from ..services.accounts import build_draft
from ..services.common import get_order, iso, is_party, s

router = APIRouter(tags=["orders"])

def order_out(o: Order) -> dict:
    return {
        "id": o.id,
        "jeweller_id": o.jeweller_id,
        "karigar_id": o.karigar_id,
        "description": o.description,
        "due_date": iso(o.due_date),
        "wastage_pct": s(o.wastage_pct),
        "status": o.status,
    }

@router.post("/orders", status_code=201)
def create_order(
    body: OrderIn,
    user: User = Depends(require_roles("jeweller")),
    db: Session = Depends(get_db),
):
    karigar = db.scalar(select(User).where(User.login == body.karigar_login, User.role == "karigar"))
    if not karigar:
        raise HTTPException(404, "No karigar with that login")
    order = Order(
        jeweller_id=user.id,
        karigar_id=karigar.id,
        description=body.description,
        due_date=body.due_date,
        wastage_pct=body.wastage_pct,
    )
    db.add(order)
    db.flush()
    audit.log(db, user.id, "order_created", "order", order.id, {"wastage_pct": str(body.wastage_pct)})
    db.commit()
    return order_out(order)

@router.get("/orders")
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = select(Order).order_by(Order.id)
    if user.role != "agent":
        q = q.where(or_(Order.jeweller_id == user.id, Order.karigar_id == user.id))
    return [order_out(o) for o in db.scalars(q)]

@router.get("/orders/{order_id}")
def get_one(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = get_order(db, order_id)
    if user.role != "agent" and not is_party(o, user):
        raise HTTPException(403, "You are not a party to this order")
    return order_out(o)

@router.get("/orders/{order_id}/summary")
def summary(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Conservation check for the order (confirmed entries only). Read-only preview."""
    o = get_order(db, order_id)
    if user.role != "agent" and not is_party(o, user):
        raise HTTPException(403, "You are not a party to this order")
    return build_draft(db, o)
