from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import PARTY
from ..models import Order, Settlement, User
from ..services.accounts import passbook as build_passbook
from ..services.common import iso

router = APIRouter(tags=["passbook"])

@router.get("/passbook/{karigar_id}")
def get_passbook(karigar_id: int, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    if user.role == "karigar":
        if user.id != karigar_id:
            raise HTTPException(403, "You can only open your own passbook")
        data = build_passbook(db, karigar_id, None)  # a karigar sees his FULL account
    else:
        has_orders = db.scalar(
            select(Order.id).where(Order.jeweller_id == user.id, Order.karigar_id == karigar_id)
        )
        if not has_orders:
            raise HTTPException(403, "This karigar has no orders with you")
        data = build_passbook(db, karigar_id, user.id)

    order_ids = [o["id"] for o in data["orders"]]
    data["settlements"] = [
        {
            "id": st.id,
            "order_id": st.order_id,
            "state": st.state,
            "partial": st.partial,
            "created_at": iso(st.created_at),
        }
        for st in db.scalars(select(Settlement).where(Settlement.order_id.in_(order_ids)))
    ]
    return data
