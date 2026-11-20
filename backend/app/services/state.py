"""The transaction state machine. Every state change goes through move(), so illegal jumps are impossible."""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..models import Order, Transaction
from .common import confirmed_user_ids

ALLOWED = {
    "AWAITING_CONFIRMATION": {"CONFIRMED_BY_BOTH", "CORRECTION_REQUESTED", "DISPUTED"},
    "CONFIRMED_BY_BOTH": {"CORRECTION_REQUESTED", "DISPUTED"},
    "CORRECTION_REQUESTED": {"CONFIRMED_BY_BOTH", "AWAITING_CONFIRMATION", "DISPUTED"},
    "DISPUTED": {"CONFIRMED_BY_BOTH"},  # only a human-approved resolution leaves DISPUTED
}

def move(tx: Transaction, new_state: str) -> None:
    if new_state not in ALLOWED.get(tx.state, set()):
        raise HTTPException(409, f"Cannot move a transaction from {tx.state} to {new_state}")
    tx.state = new_state

def settled_state(db: Session, tx: Transaction, order: Order) -> str:
    """After a rejected correction: go back to whatever the confirmations say."""
    ids = confirmed_user_ids(db, tx.id, tx.current_version)
    return "CONFIRMED_BY_BOTH" if {order.jeweller_id, order.karigar_id} <= ids else "AWAITING_CONFIRMATION"
