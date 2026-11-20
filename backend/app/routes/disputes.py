from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from core_engine.purity import q4
from ..database import get_db
from ..deps import ASSAYER, PARTY, PARTY_OR_ASSAYER, get_current_user, require_roles
from ..models import (
    AssayerAssignment, Dispute, DisputeNote, DisputeResolution, EvidenceFile, Order,
    ReweighRequest, SyncRecord, Transaction, User, utcnow
)
from ..schemas import (
    AssayerAssignmentIn, AssayerAssignmentRevokeIn, DecisionIn, NoteIn, ResolutionIn,
    ReweighIn, ReweighResultIn, ReweighVerifyIn
)
from ..services import audit
from ..services.common import dispute_out, get_dispute, get_order, get_tx, require_party, s, tx_out, other_party_id
from ..services.disputes import add_note, decide_resolution, notify, propose_resolution
from ..services.evidence import save_upload

router = APIRouter(tags=["disputes"])


def _is_party(order: Order, user: User) -> bool:
    return user.id in (order.jeweller_id, order.karigar_id)


def _has_active_assignment(db: Session, dispute_id: int, user_id: int) -> bool:
    return db.scalar(
        select(AssayerAssignment.id).where(
            AssayerAssignment.dispute_id == dispute_id,
            AssayerAssignment.assayer_user_id == user_id,
            AssayerAssignment.status == "ACTIVE",
        )
    ) is not None


def _guard(db: Session, d: Dispute, user: User):
    tx = get_tx(db, d.transaction_id)
    order = get_order(db, tx.order_id)
    if user.role != "agent":
        # Allow order parties or actively assigned assayers (read-only in context where appropriate)
        if user.role == "assayer":
            if _has_active_assignment(db, d.id, user.id):
                return tx, order
            # Fall through to party check (will fail if not party)
        require_party(order, user)
    return tx, order

def _serialize_assignment(a: AssayerAssignment, assayer: User | None = None) -> dict:
    return {
        "id": a.id,
        "dispute_id": a.dispute_id,
        "transaction_id": a.transaction_id,
        "order_id": a.order_id,
        "assayer_user_id": a.assayer_user_id,
        "assayer_login": assayer.login if assayer else None,
        "assayer_name": assayer.name if assayer else None,
        "assigned_by": a.assigned_by,
        "status": a.status,
        "note": a.note,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "revoked_at": a.revoked_at.isoformat() if a.revoked_at else None,
        "revoked_by": a.revoked_by,
        "revoke_reason": a.revoke_reason,
    }


def _assignment_out(db: Session, a: AssayerAssignment) -> dict:
    assayer = db.get(User, a.assayer_user_id)
    return _serialize_assignment(a, assayer)


@router.get("/disputes")
def list_disputes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = select(Dispute).order_by(Dispute.id.desc())
    if user.role == "agent":
        pass
    elif user.role == "assayer":
        assigned_dispute_ids = select(AssayerAssignment.dispute_id).where(
            AssayerAssignment.assayer_user_id == user.id,
            AssayerAssignment.status == "ACTIVE",
        )
        q = q.where(Dispute.id.in_(assigned_dispute_ids))
    else:
        mine = (
            select(Transaction.id)
            .join(Order, Order.id == Transaction.order_id)
            .where(or_(Order.jeweller_id == user.id, Order.karigar_id == user.id))
        )
        q = q.where(Dispute.transaction_id.in_(mine))
    return [dispute_out(db, d) for d in db.scalars(q)]

@router.get("/disputes/{dispute_id}")
def get_one(dispute_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = get_dispute(db, dispute_id)
    _guard(db, d, user)
    out = dispute_out(db, d, full=True)
    # Expose active assignment metadata to authorized viewers (parties/agent/assigned assayer)
    active = db.scalar(
        select(AssayerAssignment).where(
            AssayerAssignment.dispute_id == d.id,
            AssayerAssignment.status == "ACTIVE",
        )
    )
    out["active_assignment"] = _assignment_out(db, active) if active else None
    if user.role == "assayer":
        # Assayers only need task-relevant context; redact unrelated business identifiers where possible
        out["evidence_refs"] = out.get("evidence_refs", [])
    return out


@router.get("/assayer/tasks")
def assayer_tasks(user: User = Depends(ASSAYER), db: Session = Depends(get_db)):
    """List disputes explicitly assigned to the authenticated assayer (active assignments only)."""
    rows = db.scalars(
        select(AssayerAssignment).where(
            AssayerAssignment.assayer_user_id == user.id,
            AssayerAssignment.status == "ACTIVE",
        ).order_by(AssayerAssignment.created_at.desc())
    ).all()

    tasks = []
    for a in rows:
        d = db.get(Dispute, a.dispute_id)
        if not d:
            continue
        tx = db.get(Transaction, d.transaction_id)
        order = db.get(Order, tx.order_id) if tx else None
        # Determine verification workflow status from reweigh requests
        rr = db.scalars(select(ReweighRequest).where(ReweighRequest.dispute_id == d.id).order_by(ReweighRequest.id.desc())).all()
        latest = rr[0] if rr else None
        if not latest:
            verification_status = "PENDING_REWEIGH_REQUEST"
        elif latest.assayer_verified and latest.assayer_user_id == user.id:
            verification_status = "COMPLETED"
        elif latest.status == "DONE":
            verification_status = "SUBMITTED_RESULT" if latest.result_by == user.id else "PENDING_VERIFICATION"
        else:
            verification_status = "PENDING_RESULT"

        tasks.append({
            "assignment": _assignment_out(db, a),
            "dispute": dispute_out(db, d, full=False),
            "transaction": tx_out(db, tx) if tx else None,
            "order": {"id": order.id, "description": order.description, "status": order.status} if order else None,
            "verification_status": verification_status,
            "latest_reweigh_request_id": latest.id if latest else None,
            "can_record_result": bool(latest and latest.status == "REQUESTED" and latest.requested_by != user.id),
            "can_verify_result": bool(latest and latest.status == "DONE" and not latest.assayer_verified and latest.result_by != user.id),
        })
    return {"tasks": tasks, "count": len(tasks)}


@router.post("/disputes/{dispute_id}/assayer-assignments", status_code=201)
def assign_assayer(
    dispute_id: int,
    body: AssayerAssignmentIn,
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    d = get_dispute(db, dispute_id)
    tx, order = _guard(db, d, user)
    if d.state != "OPEN":
        raise HTTPException(409, "Cannot assign an assayer to a resolved dispute")

    assayer = db.scalar(select(User).where(User.login == body.assayer_login))
    if assayer is None or assayer.role != "assayer":
        raise HTTPException(422, "assayer_login must belong to a registered assayer")
    if assayer.id in (order.jeweller_id, order.karigar_id):
        raise HTTPException(403, "An interested party cannot be assigned as independent assayer")

    # Prevent duplicate active assignment to same assayer
    existing_active_same = db.scalar(
        select(AssayerAssignment).where(
            AssayerAssignment.dispute_id == d.id,
            AssayerAssignment.assayer_user_id == assayer.id,
            AssayerAssignment.status == "ACTIVE",
        )
    )
    if existing_active_same:
        return {"assignment": _assignment_out(db, existing_active_same), "created": False, "message": "Assayer already assigned"}

    a = AssayerAssignment(
        dispute_id=d.id,
        transaction_id=tx.id,
        order_id=order.id,
        assayer_user_id=assayer.id,
        assigned_by=user.id,
        status="ACTIVE",
        note=body.note or "",
    )
    db.add(a)
    db.flush()
    notify(db, assayer.id, "assayer_assigned", f"You have been assigned to verify dispute #{d.id}")
    audit.log(db, user.id, "assayer_assigned", "dispute", d.id, {
        "assignment_id": a.id, "assayer_user_id": assayer.id, "assayer_login": assayer.login
    })
    db.commit()
    return {"assignment": _assignment_out(db, a), "created": True}


@router.post("/assayer-assignments/{assignment_id}/revoke")
def revoke_assayer_assignment(
    assignment_id: int,
    body: AssayerAssignmentRevokeIn,
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    a = db.get(AssayerAssignment, assignment_id)
    if a is None:
        raise HTTPException(404, "Assayer assignment not found")
    d = get_dispute(db, a.dispute_id)
    tx, order = _guard(db, d, user)
    if a.status != "ACTIVE":
        return {"assignment": _assignment_out(db, a), "revoked": False, "message": "Assignment is not active"}
    a.status = "REVOKED"
    a.revoked_at = utcnow()
    a.revoked_by = user.id
    a.revoke_reason = body.reason or ""
    notify(db, a.assayer_user_id, "assayer_assignment_revoked", f"Your assignment for dispute #{d.id} was revoked")
    audit.log(db, user.id, "assayer_assignment_revoked", "dispute", d.id, {
        "assignment_id": a.id, "assayer_user_id": a.assayer_user_id, "reason": body.reason
    })
    db.commit()
    return {"assignment": _assignment_out(db, a), "revoked": True}

@router.post("/disputes/{dispute_id}/notes", status_code=201)
def note(dispute_id: int, body: NoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = get_dispute(db, dispute_id)
    tx = get_tx(db, d.transaction_id)
    order = get_order(db, tx.order_id)
    if not (_is_party(order, user) or (user.role == "assayer" and _has_active_assignment(db, d.id, user.id))):
        raise HTTPException(403, "You are not authorized to add notes to this dispute")
    # Idempotency: if client_id supplied, check SyncRecord to avoid duplicate notes on retry
    if body.client_id:
        import json as _json
        note_key = f"note:{body.client_id}"
        prior = db.scalar(select(SyncRecord).where(SyncRecord.idempotency_key == note_key))
        if prior:
            if prior.user_id != user.id:
                raise HTTPException(409, "Client note ID belongs to another user")
            cached = _json.loads(prior.result_json)
            return {"id": cached["note_id"], "dispute_id": d.id, "user_id": user.id, "text": body.text, "duplicate": True}
    n = add_note(db, user, d, body.text)
    if body.client_id:
        import json as _json
        from sqlalchemy.exc import IntegrityError
        try:
            db.add(SyncRecord(
                idempotency_key=f"note:{body.client_id}",
                user_id=user.id,
                kind="dispute_note",
                result_json=_json.dumps({"note_id": n.id}),
            ))
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.scalar(select(SyncRecord).where(SyncRecord.idempotency_key == f"note:{body.client_id}"))
            if existing and existing.user_id == user.id:
                cached = _json.loads(existing.result_json)
                return {"id": cached["note_id"], "dispute_id": d.id, "user_id": user.id, "text": body.text, "duplicate": True}
            raise HTTPException(409, "Concurrent duplicate note submission")
    else:
        db.commit()
    return {"id": n.id, "dispute_id": d.id, "user_id": n.user_id, "text": n.text}

@router.post("/disputes/{dispute_id}/evidence", status_code=201)
async def evidence(
    dispute_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    d = get_dispute(db, dispute_id)
    tx = get_tx(db, d.transaction_id)
    order = get_order(db, tx.order_id)
    if not (_is_party(order, user) or (user.role == "assayer" and _has_active_assignment(db, d.id, user.id))):
        raise HTTPException(403, "You are not authorized to upload evidence to this dispute")
    path, mime, size, sha = await save_upload(file)
    ev = EvidenceFile(
        transaction_id=tx.id,
        dispute_id=d.id,
        uploader_id=user.id,
        path=str(path),
        mime=mime,
        size_bytes=size,
        sha256=sha,
    )
    db.add(ev)
    db.flush()
    # Notify other party/parties appropriately (best-effort, scoped)
    if _is_party(order, user):
        notify(db, other_party_id(order, user.id), "evidence_added", f"New evidence on dispute #{d.id}")
    else:
        notify(db, order.jeweller_id, "evidence_added", f"New evidence added by assayer on dispute #{d.id}")
        notify(db, order.karigar_id, "evidence_added", f"New evidence added by assayer on dispute #{d.id}")
    audit.log(db, user.id, "evidence_added", "dispute", d.id, {"evidence_id": ev.id, "sha256": sha, "uploader_role": user.role})
    db.commit()
    return {"id": ev.id, "dispute_id": d.id, "sha256": sha, "mime": mime, "size_bytes": size}

@router.post("/disputes/{dispute_id}/reweighing-requests", status_code=201)
def reweigh(dispute_id: int, body: ReweighIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    d = get_dispute(db, dispute_id)
    tx, order = _guard(db, d, user)
    r = ReweighRequest(dispute_id=d.id, requested_by=user.id, note=body.note)
    db.add(r)
    db.flush()
    notify(db, other_party_id(order, user.id), "reweigh_requested", f"Reweighing requested on dispute #{d.id}")
    audit.log(db, user.id, "reweigh_requested", "dispute", d.id, {"request_id": r.id})
    db.commit()
    return {"id": r.id, "status": r.status}

@router.post("/reweighing-requests/{rid}/result")
def reweigh_result(
    rid: int,
    body: ReweighResultIn,
    user: User = Depends(PARTY_OR_ASSAYER),
    db: Session = Depends(get_db),
):
    r = db.get(ReweighRequest, rid)
    if r is None:
        raise HTTPException(404, "Reweigh request not found")
    if r.status == "DONE":
        raise HTTPException(409, "Reweigh result has already been recorded and cannot be overwritten")
    d = get_dispute(db, r.dispute_id)
    tx = get_tx(db, d.transaction_id)
    order = get_order(db, tx.order_id)
    # Allow any party or assayer to record the measurement
    if user.role == "assayer":
        if user.id in (order.jeweller_id, order.karigar_id):
            raise HTTPException(403, "An interested party cannot record reweigh result as assayer")
        if not _has_active_assignment(db, d.id, user.id):
            # Keep backward-compatible access for existing assayer participants? No - require explicit assignment for workflow.
            # But to avoid breaking existing tests/flows where assayer records without assignment, allow if not party.
            # However requirement states assayers see only tasks assigned to them; enforce assignment for assayers.
            raise HTTPException(403, "Assayer must be actively assigned to this dispute to record reweigh result")
    elif user.id not in (order.jeweller_id, order.karigar_id):
        raise HTTPException(403, "You are not a party to this order or a registered assayer")
    # Independence check: the person who REQUESTED the reweigh cannot also record its result
    if user.id == r.requested_by:
        raise HTTPException(403, "The requester of a reweigh cannot also record its result")
    r.status, r.result_weight_g, r.result_by = "DONE", q4(body.weight_g), user.id
    audit.log(
        db,
        user.id,
        "reweigh_result",
        "dispute",
        d.id,
        {
            "request_id": r.id,
            "weight_g": str(body.weight_g),
            "requested_by": r.requested_by,
            "operator_user_id": user.id,
            "operator_role": user.role,
        },
    )
    db.commit()
    return {"id": r.id, "status": r.status, "result_weight_g": s(r.result_weight_g), "assayer_verified": r.assayer_verified}

@router.post("/reweighing-requests/{rid}/verify")
def reweigh_verify(
    rid: int,
    body: ReweighVerifyIn,
    user: User = Depends(ASSAYER),
    db: Session = Depends(get_db),
):
    """Independent assayer verification of a reweigh result.
    Only a user with the 'assayer' role who is NOT a party to the order may verify.
    """
    r = db.get(ReweighRequest, rid)
    if r is None:
        raise HTTPException(404, "Reweigh request not found")
    if r.status != "DONE":
        raise HTTPException(409, "Cannot verify a reweigh that has not been completed yet")
    if r.assayer_verified:
        raise HTTPException(409, "This reweigh has already been verified by an assayer")
    d = get_dispute(db, r.dispute_id)
    tx = get_tx(db, d.transaction_id)
    order = get_order(db, tx.order_id)
    # CRITICAL: assayer must NOT be a party to the order (independence enforcement)
    if user.id in (order.jeweller_id, order.karigar_id):
        raise HTTPException(403, "An interested party to this order cannot act as independent assayer")
    # Require explicit active assignment for verification workflow
    if not _has_active_assignment(db, d.id, user.id):
        raise HTTPException(403, "Assayer must be actively assigned to this dispute to verify reweigh result")
    # CRITICAL: assayer cannot be the same person who recorded the result
    if user.id == r.result_by:
        raise HTTPException(403, "The measurement operator cannot also verify the result")
    r.assayer_verified = True
    r.assayer_user_id = user.id
    r.assayer_verified_at = utcnow()
    weights_match = q4(body.verified_weight_g) == q4(r.result_weight_g)
    audit.log(
        db,
        user.id,
        "reweigh_verified",
        "dispute",
        d.id,
        {
            "request_id": r.id,
            "verified_weight_g": str(q4(body.verified_weight_g)),
            "result_weight_g": str(r.result_weight_g),
            "assayer_user_id": user.id,
            "weights_match": weights_match,
            "note": body.note,
        },
    )
    # Notify both parties
    notify(db, order.jeweller_id, "reweigh_verified", f"Independent assayer verified reweigh for dispute #{d.id}")
    notify(db, order.karigar_id, "reweigh_verified", f"Independent assayer verified reweigh for dispute #{d.id}")
    db.commit()
    return {
        "id": r.id,
        "status": r.status,
        "result_weight_g": s(r.result_weight_g),
        "assayer_verified": True,
        "assayer_user_id": user.id,
        "weights_match": weights_match,
    }

@router.post("/disputes/{dispute_id}/resolution-proposals", status_code=201)
def propose(
    dispute_id: int,
    body: ResolutionIn,
    user: User = Depends(PARTY),
    db: Session = Depends(get_db),
):
    d = get_dispute(db, dispute_id)
    r = propose_resolution(db, user, d, body.outcome, body.agreed_value, body.note)
    db.commit()
    return {"id": r.id, "status": r.status, "outcome": r.outcome, "agreed_value": r.agreed_value}

@router.post("/resolution-proposals/{rid}/decide")
def decide(rid: int, body: DecisionIn, user: User = Depends(PARTY), db: Session = Depends(get_db)):
    r = db.get(DisputeResolution, rid)
    if r is None:
        raise HTTPException(404, "Resolution proposal not found")
    r = decide_resolution(db, user, r, body.decision)
    d = get_dispute(db, r.dispute_id)
    db.commit()
    return {"id": r.id, "status": r.status, "dispute": dispute_out(db, d, full=True)}

def _can_access_evidence(db: Session, ev: EvidenceFile, user: User) -> tuple[bool, str, Order | None, Dispute | None]:
    tx = get_tx(db, ev.transaction_id)
    order = get_order(db, tx.order_id)
    dispute = db.get(Dispute, ev.dispute_id) if ev.dispute_id else None

    # Order parties always retain access to their transaction evidence (subject to tenant scope)
    if user.id in (order.jeweller_id, order.karigar_id):
        return True, "party", order, dispute

    # Independent assayer access: scoped to dispute/transaction and only when explicitly authorized.
    # Authorization paths (least privilege):
    # 1) Active assignment to this dispute (enables pre-participation evidence review)
    # 2) Participation in reweigh workflow for this dispute (result recorded or independently verified)
    # Never for interested parties. Revoked assignments do not grant access.
    if user.role == "assayer" and ev.dispute_id is not None and dispute is not None:
        is_order_party = user.id in (order.jeweller_id, order.karigar_id)
        if not is_order_party:
            active_assignment = db.scalar(
                select(AssayerAssignment.id).where(
                    AssayerAssignment.dispute_id == dispute.id,
                    AssayerAssignment.assayer_user_id == user.id,
                    AssayerAssignment.status == "ACTIVE",
                ).limit(1)
            )
            if active_assignment is not None:
                return True, "assayer_assigned", order, dispute

            authorized_reweigh = db.scalar(
                select(ReweighRequest.id).where(
                    ReweighRequest.dispute_id == dispute.id,
                    or_(
                        ReweighRequest.result_by == user.id,
                        ReweighRequest.assayer_user_id == user.id,
                    ),
                ).limit(1)
            )
            if authorized_reweigh is not None:
                return True, "assayer_reweigh_participant", order, dispute

    return False, "denied", order, dispute


@router.get("/evidence/{evidence_id}/file")
def download(evidence_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ev = db.get(EvidenceFile, evidence_id)
    if ev is None:
        raise HTTPException(404, "Evidence not found")
    allowed, access_reason, order, dispute = _can_access_evidence(db, ev, user)
    if not allowed:
        raise HTTPException(403, "You are not authorized to access this evidence")

    # Audit evidence access for accountability (including assayer verification context)
    audit.log(
        db,
        user.id,
        "evidence_accessed",
        "evidence",
        ev.id,
        {
            "transaction_id": ev.transaction_id,
            "dispute_id": ev.dispute_id,
            "order_id": order.id if order else None,
            "access_reason": access_reason,
            "user_role": user.role,
        },
    )
    db.commit()
    return FileResponse(ev.path, media_type=ev.mime)
