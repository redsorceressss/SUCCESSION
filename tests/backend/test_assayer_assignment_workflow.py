"""Phase 7: Explicit assayer assignment workflow and authorization tests."""

import pytest
from tests.conftest import PNG, login_headers, register


def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)


@pytest.fixture
def assignment_world(client, db_session):
    register(client, "jeweller1", "jeweller", "Mehta Jewellers")
    register(client, "karigar1", "karigar", "Ramesh Karigar")
    register(client, "assayer1", "assayer", "Independent Assayer")
    register(client, "assayer2", "assayer", "Second Assayer")
    register(client, "outsider", "karigar", "Outsider Karigar")
    register(client, "jeweller2", "jeweller", "Other Jeweller")
    register(client, "karigar2", "karigar", "Other Karigar")

    J = login_headers(client, "jeweller1")
    K = login_headers(client, "karigar1")
    A1 = login_headers(client, "assayer1")
    A2 = login_headers(client, "assayer2")
    OUT = login_headers(client, "outsider")
    J2 = login_headers(client, "jeweller2")
    K2 = login_headers(client, "karigar2")

    # Primary order/transaction/dispute
    r = client.post("/orders", headers=J, json={"karigar_login": "karigar1", "description": "Ring", "due_date": "2026-12-01", "wastage_pct": "1"})
    oid = r.json()["id"]
    r = client.post("/transactions/issue", headers=J, json={"order_id": oid, "weight_g": "10.00", "karat": 22, "note": "Ring gold"})
    tid = r.json()["id"]
    d = post(client, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="9.95", reason="Weight off")
    did = d.json()["id"]
    ev = client.post(f"/disputes/{did}/evidence", headers=K, files={"file": ("scale.png", PNG, "image/png")})
    eid = ev.json()["id"]
    rr = client.post(f"/disputes/{did}/reweighing-requests", headers=J, json={"note": "Need reweigh"})
    rid = rr.json()["id"]

    # Unrelated dispute (different parties)
    r = client.post("/orders", headers=J2, json={"karigar_login": "karigar2", "description": "Chain", "due_date": "2026-12-05", "wastage_pct": "1"})
    oid2 = r.json()["id"]
    r = client.post("/transactions/issue", headers=J2, json={"order_id": oid2, "weight_g": "5.00", "karat": 18, "note": "Chain gold"})
    tid2 = r.json()["id"]
    d2 = post(client, f"/transactions/{tid2}/disputes", K2, field="weight_g", claimed_value="4.95", reason="Weight off")
    did2 = d2.json()["id"]
    ev2 = client.post(f"/disputes/{did2}/evidence", headers=K2, files={"file": ("scale2.png", PNG, "image/png")})
    eid2 = ev2.json()["id"]

    return {
        "c": client, "db": db_session,
        "J": J, "K": K, "A1": A1, "A2": A2, "OUT": OUT, "J2": J2, "K2": K2,
        "oid": oid, "tid": tid, "did": did, "eid": eid, "rid": rid,
        "oid2": oid2, "tid2": tid2, "did2": did2, "eid2": eid2,
    }


def test_authorized_party_can_assign_assayer(assignment_world):
    w = assignment_world
    r = w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1", "note": "Assign"})
    assert r.status_code == 201
    assert r.json()["assignment"]["status"] == "ACTIVE"


def test_unauthorized_assignment_attempt_denied(assignment_world):
    w = assignment_world
    # Outsider (not party to order/dispute) cannot assign
    r = w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["OUT"], json={"assayer_login": "assayer1"})
    assert r.status_code == 403


def test_assigned_assayer_can_view_task_and_dispute_detail(assignment_world):
    w = assignment_world
    w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    tasks = w["c"].get("/assayer/tasks", headers=w["A1"])
    assert tasks.status_code == 200
    assert any(t["dispute"]["id"] == w["did"] for t in tasks.json()["tasks"])
    detail = w["c"].get(f"/disputes/{w['did']}", headers=w["A1"])
    assert detail.status_code == 200
    assert detail.json()["id"] == w["did"]


def test_unassigned_assayer_cannot_view_task_or_dispute(assignment_world):
    w = assignment_world
    # No assignment for assayer2
    tasks = w["c"].get("/assayer/tasks", headers=w["A2"])
    assert tasks.status_code == 200
    assert all(t["dispute"]["id"] != w["did"] for t in tasks.json()["tasks"])
    detail = w["c"].get(f"/disputes/{w['did']}", headers=w["A2"])
    assert detail.status_code == 403


def test_assigned_assayer_can_access_evidence_before_reweigh_submission(assignment_world):
    w = assignment_world
    w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    # No reweigh result submitted yet; assignment should allow evidence access
    r = w["c"].get(f"/evidence/{w['eid']}/file", headers=w["A1"])
    assert r.status_code == 200


def test_assayer_cannot_access_unrelated_dispute_evidence(assignment_world):
    w = assignment_world
    w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    # Assigned to did, must not access evidence from unrelated did2
    r = w["c"].get(f"/evidence/{w['eid2']}/file", headers=w["A1"])
    assert r.status_code == 403


def test_revoked_assignee_loses_access(assignment_world):
    w = assignment_world
    a = w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    aid = a.json()["assignment"]["id"]
    ok = w["c"].get(f"/evidence/{w['eid']}/file", headers=w["A1"])
    assert ok.status_code == 200
    rev = w["c"].post(f"/assayer-assignments/{aid}/revoke", headers=w["K"], json={"reason": "No longer needed"})
    assert rev.status_code == 200
    denied = w["c"].get(f"/evidence/{w['eid']}/file", headers=w["A1"])
    assert denied.status_code == 403
    detail = w["c"].get(f"/disputes/{w['did']}", headers=w["A1"])
    assert detail.status_code == 403


def test_jeweller_and_karigar_party_access_remains_intact(assignment_world):
    w = assignment_world
    assert w["c"].get(f"/disputes/{w['did']}", headers=w["J"]).status_code == 200
    assert w["c"].get(f"/disputes/{w['did']}", headers=w["K"]).status_code == 200
    assert w["c"].get(f"/evidence/{w['eid']}/file", headers=w["J"]).status_code == 200
    assert w["c"].get(f"/evidence/{w['eid']}/file", headers=w["K"]).status_code == 200


def test_assayer_cannot_modify_original_transaction_or_settle(assignment_world):
    w = assignment_world
    w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    # Cannot confirm transaction
    r = post(w["c"], f"/transactions/{w['tid']}/confirm", w["A1"], version_no=1)
    assert r.status_code == 403
    # Cannot create/request correction as party
    r = w["c"].post(f"/transactions/{w['tid']}/correction-requests", headers=w["A1"], json={"field": "weight_g", "proposed_value": "9.99", "reason": "x"})
    assert r.status_code == 403
    # Cannot propose/decide resolution (party-only endpoints)
    r = w["c"].post(f"/disputes/{w['did']}/resolution-proposals", headers=w["A1"], json={"outcome": "ORIGINAL_STANDS", "note": "x"})
    assert r.status_code == 403
    # Cannot create settlement or approve settlement (party/jeweller endpoints)
    r = w["c"].post("/settlements", headers=w["A1"], json={"order_id": w["oid"]})
    assert r.status_code in (401, 403)


def test_cross_tenant_access_denied_for_assayer_assignment(assignment_world):
    w = assignment_world
    # Assayer assigned to dispute did must not access unrelated dispute did2 details/evidence
    w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    assert w["c"].get(f"/disputes/{w['did2']}", headers=w["A1"]).status_code == 403
    assert w["c"].get(f"/evidence/{w['eid2']}/file", headers=w["A1"]).status_code == 403


def test_assignment_and_evidence_access_produce_audit_records(assignment_world):
    w = assignment_world
    a = w["c"].post(f"/disputes/{w['did']}/assayer-assignments", headers=w["J"], json={"assayer_login": "assayer1"})
    assert a.status_code == 201
    r = w["c"].get(f"/evidence/{w['eid']}/file", headers=w["A1"])
    assert r.status_code == 200

    # Audit events are stored as hash-chained payloads; verify relevant actions exist
    from backend.app.models import AuditEvent
    import json
    events = w["db"].query(AuditEvent).all()
    payloads = [json.loads(e.payload) for e in events]
    actions = [p.get("action") for p in payloads]
    assert "assayer_assigned" in actions
    assert "evidence_accessed" in actions
    # Revoke and ensure audit recorded
    aid = a.json()["assignment"]["id"]
    rev = w["c"].post(f"/assayer-assignments/{aid}/revoke", headers=w["J"], json={"reason": "done"})
    assert rev.status_code == 200
    events = w["db"].query(AuditEvent).all()
    actions = [json.loads(e.payload).get("action") for e in events]
    assert "assayer_assignment_revoked" in actions