"""POST /scale-photos: validation, OCR outcomes, evidence/audit linkage, no financial mutation."""

from pathlib import Path
from ai_engine.ocr.read_display import Reading
from backend.app.models import AuditEvent, EvidenceFile, Settlement, Transaction
from tests.conftest import PNG, login_headers, register


def _upload(client, headers, tx_id, entered, content=PNG, filename="scale.png", ctype="image/png"):
    return client.post(
        "/scale-photos",
        headers=headers,
        data={"transaction_id": str(tx_id), "entered_weight": str(entered)},
        files={"file": (filename, content, ctype)},
    )


def test_scale_photo_requires_party_auth(client, world):
    r = _upload(client, {}, world["tid"], "50.00")
    assert r.status_code == 401


def test_scale_photo_rejects_non_party_user(client, world, db_session):
    # assayer is not in PARTY dependency for this endpoint
    from backend.app.models import User
    from backend.app.security import hash_password
    assayer = User(login="assayer_scale", name="Assayer", password_hash=hash_password("AssayerPass123!"), role="assayer")
    db_session.add(assayer)
    db_session.commit()
    A = login_headers(client, "assayer_scale", "AssayerPass123!")
    r = _upload(client, A, world["tid"], "50.00")
    assert r.status_code == 403


def test_scale_photo_rejects_unrelated_party(client, world):
    register(client, "karigar2b", "karigar", "Other Karigar")
    K2 = login_headers(client, "karigar2b")
    r = _upload(client, K2, world["tid"], "50.00")
    assert r.status_code == 403


def test_scale_photo_rejects_invalid_entered_weight(client, world):
    r = _upload(client, world["J"], world["tid"], "abc")
    assert r.status_code == 422
    r2 = _upload(client, world["J"], world["tid"], "0")
    assert r2.status_code == 422
    r3 = _upload(client, world["J"], world["tid"], "-1")
    assert r3.status_code == 422


def test_scale_photo_rejects_invalid_image_type(client, world):
    r = _upload(client, world["J"], world["tid"], "50.00", content=b"%PDF-1.4 fake", filename="x.pdf", ctype="application/pdf")
    assert r.status_code == 415


def test_scale_photo_rejects_empty_upload(client, world):
    r = _upload(client, world["J"], world["tid"], "50.00", content=b"")
    assert r.status_code == 422


def test_scale_photo_match_persists_evidence_and_audit_without_financial_mutation(client, world, db_session, monkeypatch):
    import backend.app.routes.scale as scale_route
    monkeypatch.setattr(scale_route, "read_display", lambda p: Reading(value=__import__("decimal").Decimal("50.00"), status="READABLE", confidence=0.95, raw="50.00"))
    tx_before = db_session.get(Transaction, world["tid"])
    state_before = tx_before.state
    count_before = db_session.query(EvidenceFile).count()
    settlements_before = db_session.query(Settlement).count()

    r = _upload(client, world["J"], world["tid"], "50.00")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "MATCH"
    assert body["needs_manual_confirm"] is False
    assert body["ocr_reading_g"] == "50.00"
    assert body["entered_g"] == "50.00"
    assert body["disclaimer"]
    assert Path(body["sha256"]) or body["sha256"]  # hex string present

    db_session.expire_all()
    tx_after = db_session.get(Transaction, world["tid"])
    assert tx_after.state == state_before
    assert db_session.query(EvidenceFile).count() == count_before + 1
    ev = db_session.get(EvidenceFile, body["evidence_id"])
    assert ev is not None
    assert ev.transaction_id == world["tid"]
    assert ev.kind == "scale_photo"
    assert str(ev.ocr_status) == "MATCH"
    assert db_session.query(Settlement).count() == settlements_before
    import json
    audits = db_session.query(AuditEvent).all()
    matched = False
    for a in audits:
        payload = json.loads(a.payload)
        if payload.get("action") == "scale_photo_added" and payload.get("entity") == "transaction" and payload.get("entity_id") == world["tid"]:
            if (payload.get("data") or {}).get("status") == "MATCH":
                matched = True
                break
    assert matched


def test_scale_photo_mismatch_requires_manual_confirm(client, world, monkeypatch):
    import backend.app.routes.scale as scale_route
    monkeypatch.setattr(scale_route, "read_display", lambda p: Reading(value=__import__("decimal").Decimal("49.85"), status="READABLE", confidence=0.95, raw="49.85"))
    r = _upload(client, world["J"], world["tid"], "50.00")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "MISMATCH"
    assert body["needs_manual_confirm"] is True
    assert body["ocr_reading_g"] == "49.85"


def test_scale_photo_unreadable_requires_manual_confirm(client, world, monkeypatch):
    import backend.app.routes.scale as scale_route
    monkeypatch.setattr(scale_route, "read_display", lambda p: Reading(value=None, status="UNREADABLE", confidence=0.1, raw=""))
    r = _upload(client, world["J"], world["tid"], "50.00")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "UNREADABLE"
    assert body["needs_manual_confirm"] is True
    assert body["ocr_reading_g"] is None


def test_scale_photo_processing_exception_becomes_unreadable_but_persists_evidence(client, world, db_session, monkeypatch):
    import backend.app.routes.scale as scale_route
    def boom(_p):
        raise RuntimeError("cv2 decode failure")
    monkeypatch.setattr(scale_route, "read_display", boom)
    count_before = db_session.query(EvidenceFile).count()
    r = _upload(client, world["J"], world["tid"], "50.00")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "UNREADABLE"
    assert body["needs_manual_confirm"] is True
    db_session.expire_all()
    assert db_session.query(EvidenceFile).count() == count_before + 1
    ev = db_session.get(EvidenceFile, body["evidence_id"])
    assert ev is not None and ev.ocr_status == "UNREADABLE" and ev.ocr_reading is None
