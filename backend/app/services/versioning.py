"""Create transaction versions and confirmations. We never edit a version; we add the next one."""

from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from core_engine.integrity import GENESIS, entry_hash
from core_engine.purity import fine_gold, q4
from ..models import Confirmation, Transaction, TransactionVersion

def add_version(
    db: Session,
    tx: Transaction,
    user_id: int,
    *,
    weight: Decimal,
    karat: int,
    scrap: Decimal,
    note: str,
    reason: str,
) -> TransactionVersion:
    prev = db.scalar(
        select(TransactionVersion)
        .where(TransactionVersion.transaction_id == tx.id)
        .order_by(TransactionVersion.version_no.desc())
        .limit(1)
    )
    version_no = prev.version_no + 1 if prev else 1
    weight, scrap = q4(Decimal(str(weight))), q4(Decimal(str(scrap)))
    payload = {
        "transaction_id": tx.id,
        "version_no": version_no,
        "weight_g": str(weight),
        "karat": karat,
        "scrap_g": str(scrap),
        "note": note or "",
        "created_by": user_id,
    }
    prev_hash = prev.version_hash if prev else GENESIS
    v = TransactionVersion(
        transaction_id=tx.id,
        version_no=version_no,
        weight_g=weight,
        karat=karat,
        fine_g=fine_gold(weight, karat),
        scrap_g=scrap,
        note=note or "",
        reason=reason,
        created_by=user_id,
        prev_hash=prev_hash,
        version_hash=entry_hash(prev_hash, payload),
    )
    db.add(v)
    tx.current_version = version_no
    db.flush()
    return v

def add_confirmation(db: Session, tx_id: int, v: TransactionVersion, user_id: int) -> None:
    exists = db.scalar(
        select(Confirmation).where(
            Confirmation.transaction_id == tx_id,
            Confirmation.version_no == v.version_no,
            Confirmation.user_id == user_id,
        )
    )
    if not exists:
        db.add(
            Confirmation(
                transaction_id=tx_id,
                version_no=v.version_no,
                user_id=user_id,
                version_hash=v.version_hash,
            )
        )
        db.flush()

def apply_field(v: TransactionVersion, field: str, raw: str) -> dict:
    """Return the keyword values for a new version = old version with ONE field changed."""
    vals = {"weight": v.weight_g, "karat": v.karat, "scrap": v.scrap_g, "note": v.note}
    try:
        if field == "weight_g":
            vals["weight"] = Decimal(raw)
            if vals["weight"] <= 0:
                raise ValueError
        elif field == "karat":
            vals["karat"] = int(raw)
            if not 1 <= vals["karat"] <= 24:
                raise ValueError
        elif field == "scrap_g":
            vals["scrap"] = Decimal(raw)
            if vals["scrap"] < 0:
                raise ValueError
        elif field == "note":
            vals["note"] = raw[:300]
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(422, f"'{raw}' is not a valid value for {field}")
    return vals

def field_value(v: TransactionVersion, field: str) -> str:
    return str({"weight_g": v.weight_g, "karat": v.karat, "scrap_g": v.scrap_g, "note": v.note}[field])
