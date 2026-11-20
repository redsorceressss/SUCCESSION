"""Append-only, hash-chained audit log. Every important action writes one row."""

import json
from sqlalchemy import select
from sqlalchemy.orm import Session
from core_engine.integrity import GENESIS, canonical, entry_hash
from ..models import AuditEvent, utcnow

def log(
    db: Session,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None,
    data: dict | None = None,
):
    last = db.scalar(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1))
    prev = last.hash if last else GENESIS
    payload = {
        "actor": actor_id,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "data": data or {},
        "at": utcnow().isoformat(),
    }
    row = AuditEvent(
        payload=canonical(payload).decode(),
        prev_hash=prev,
        hash=entry_hash(prev, payload),
    )
    db.add(row)
    db.flush()
    return row

def verify(db: Session) -> tuple[bool, int | None, int]:
    """Re-compute the chain. Returns (ok, first_bad_row_id, rows_checked)."""
    prev = GENESIS
    n = 0
    for row in db.scalars(select(AuditEvent).order_by(AuditEvent.id)):
        n += 1
        if row.prev_hash != prev or entry_hash(prev, json.loads(row.payload)) != row.hash:
            return False, row.id, n
        prev = row.hash
    return True, None, n
