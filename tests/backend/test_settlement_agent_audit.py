"""Tests for settlement dual-approval, agent boundaries, audit tamper detection, and offline sync."""

from decimal import Decimal
import pytest
from sqlalchemy import text
from tests.conftest import make_agent, login_headers

def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)

def test_agent_can_draft_but_cannot_approve(world):
    c, db, J, K, oid, tid = world["c"], world["db"], world["J"], world["K"], world["oid"], world["tid"]
    A = make_agent(c, db)

    # Karigar confirms entry so it is CONFIRMED_BY_BOTH
    post(c, f"/transactions/{tid}/confirm", K, version_no=1)

    # Agent drafts settlement
    st = post(c, "/settlements", A, order_id=oid).json()
    sid = st["id"]
    assert st["state"] == "DRAFT"

    # Agent attempts to approve settlement -> 403 Forbidden!
    r_agent_app = c.post(f"/settlements/{sid}/approve", headers=A, json={"accept_partial": False})
    assert r_agent_app.status_code == 403

def test_settlement_dual_approval(world):
    c, J, K, oid, tid = world["c"], world["J"], world["K"], world["oid"], world["tid"]
    post(c, f"/transactions/{tid}/confirm", K, version_no=1)

    st = post(c, "/settlements", J, order_id=oid).json()
    sid = st["id"]

    # Jeweller approves
    app1 = post(c, f"/settlements/{sid}/approve", J, accept_partial=False).json()
    assert app1["state"] == "DRAFT"  # Still draft because karigar hasn't approved yet

    # Karigar approves
    app2 = post(c, f"/settlements/{sid}/approve", K, accept_partial=False).json()
    assert app2["state"] == "APPROVED"  # Now both have approved!

def test_settlement_blocked_by_open_dispute_unless_partial(world):
    c, J, K, oid, tid = world["c"], world["J"], world["K"], world["oid"], world["tid"]
    # Karigar disputes entry
    post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85")

    st = post(c, "/settlements", J, order_id=oid).json()
    sid = st["id"]

    # Jeweller attempts standard approval without accept_partial -> 409
    r = post(c, f"/settlements/{sid}/approve", J, accept_partial=False)
    assert r.status_code == 409
    assert "in dispute and held" in r.json()["detail"]

    # Jeweller approves with accept_partial=True
    r_partial = post(c, f"/settlements/{sid}/approve", J, accept_partial=True)
    assert r_partial.status_code == 200

def test_stale_settlement_draft_rejected(world):
    c, J, K, oid, tid = world["c"], world["J"], world["K"], world["oid"], world["tid"]
    post(c, f"/transactions/{tid}/confirm", K, version_no=1)

    st = post(c, "/settlements", J, order_id=oid).json()
    sid = st["id"]

    # Now add another return transaction to change the balance
    post(c, "/transactions/return", J, order_id=oid, weight_g="10.00", karat=22, scrap_g="0.10")

    # Trying to approve the old draft must return 409 Stale Draft
    r = post(c, f"/settlements/{sid}/approve", J, accept_partial=False)
    assert r.status_code == 409
    assert "accounts changed" in r.json()["detail"]

def test_audit_verification_and_tamper_detection(world):
    c, db, J = world["c"], world["db"], world["J"]

    # Verify chain is currently ok
    v_ok = c.get("/audit/verify", headers=J).json()
    assert v_ok["ok"] is True
    assert v_ok["first_bad_row"] is None
    assert v_ok["rows_checked"] > 0

    # Tamper with an audit row directly in database
    db.execute(text("UPDATE audit_events SET prev_hash = 'tampered_hash_value' WHERE id = 1"))
    db.commit()

    # Chain verification should now fail
    v_fail = c.get("/audit/verify", headers=J).json()
    assert v_fail["ok"] is False
    assert v_fail["first_bad_row"] is not None

def test_offline_sync_idempotency(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    sync_payload = {
        "items": [
            {
                "idempotency_key": "offline-action-key-1001",
                "kind": "dispute_create",
                "payload": {
                    "transaction_id": tid,
                    "field": "weight_g",
                    "claimed_value": "49.85",
                    "reason": "Offline check",
                },
            }
        ]
    }

    # First sync call
    r1 = c.post("/sync", headers=K, json=sync_payload).json()
    assert len(r1["results"]) == 1
    assert r1["results"][0]["status"] == "accepted"

    # Second sync call with exact same idempotency_key
    r2 = c.post("/sync", headers=K, json=sync_payload).json()
    assert len(r2["results"]) == 1
    assert r2["results"][0]["status"] == "duplicate"  # No duplicate row created!
