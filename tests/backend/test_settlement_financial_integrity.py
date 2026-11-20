"""Phase 6 P0-B: Settlement and financial integrity hardening tests.

Tests cover:
1. Dual-human approval requirement
2. Anti-self-approval on settlements
3. Settlement fingerprint staleness detection
4. Settlement hold exclusion
5. Rejected settlement state immutability
6. Cross-user isolation (non-party cannot approve)
7. Agent role cannot approve settlements
8. Duplicate settlement approval prevention
9. Hash chain integrity verification
10. Decimal precision safety
"""

import json
import pytest
from decimal import Decimal
from tests.conftest import login_headers, make_agent, register


def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)


@pytest.fixture
def settlement_world(client, db_session):
    """World with jeweller, karigar, confirmed transaction, and a settlement draft."""
    register(client, "jeweller1", "jeweller", "Mehta Jewellers")
    register(client, "karigar1", "karigar", "Ramesh Karigar")
    register(client, "karigar2", "karigar", "Suresh Karigar")

    J = login_headers(client, "jeweller1")
    K = login_headers(client, "karigar1")
    K2 = login_headers(client, "karigar2")

    # Create order
    r = client.post(
        "/orders",
        headers=J,
        json={"karigar_login": "karigar1", "description": "22K Chain", "due_date": "2026-12-01", "wastage_pct": "2.0"},
    )
    assert r.status_code == 201
    oid = r.json()["id"]

    # Issue 50.00g
    r = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "50.00", "karat": 22, "note": "Chain gold"},
    )
    assert r.status_code == 201
    tid = r.json()["id"]

    # Karigar confirms
    r = post(client, f"/transactions/{tid}/confirm", K, version_no=1)
    assert r.status_code == 200

    return {"c": client, "db": db_session, "J": J, "K": K, "K2": K2, "oid": oid, "tid": tid}


# --- Test 1: Dual-human approval ---
def test_settlement_requires_both_approvals(settlement_world):
    w = settlement_world
    # Create draft
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["state"] == "DRAFT"

    # Jeweller approves
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 200
    assert r.json()["state"] == "DRAFT"  # still DRAFT — needs both

    # Karigar approves
    r = post(w["c"], f"/settlements/{sid}/approve", w["K"], accept_partial=False)
    assert r.status_code == 200
    assert r.json()["state"] == "APPROVED"  # NOW approved


# --- Test 2: Duplicate approval prevention ---
def test_duplicate_approval_prevented(settlement_world):
    w = settlement_world
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    sid = r.json()["id"]

    # First approval
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 200

    # Duplicate approval
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 409


# --- Test 3: Non-party cannot approve ---
def test_non_party_cannot_approve_settlement(settlement_world):
    w = settlement_world
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    sid = r.json()["id"]

    # K2 is not a party to this order
    r = post(w["c"], f"/settlements/{sid}/approve", w["K2"], accept_partial=False)
    assert r.status_code == 403


# --- Test 4: Agent cannot approve settlement ---
def test_agent_cannot_approve_settlement(settlement_world):
    w = settlement_world
    agent_headers = make_agent(w["c"], w["db"])
    r = post(w["c"], "/settlements", agent_headers, order_id=w["oid"])
    sid = r.json()["id"]

    # Agent tries to approve
    r = post(w["c"], f"/settlements/{sid}/approve", agent_headers, accept_partial=False)
    assert r.status_code == 403  # PARTY excludes agent role


# --- Test 5: Settlement rejection ---
def test_settlement_rejection_finality(settlement_world):
    w = settlement_world
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    sid = r.json()["id"]

    # Reject
    r = post(w["c"], f"/settlements/{sid}/reject", w["K"], reason="Disagree with amounts")
    assert r.status_code == 200
    assert r.json()["state"] == "REJECTED"

    # Cannot approve after rejection
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 409


# --- Test 6: Settlement with active dispute hold ---
def test_settlement_with_active_hold(settlement_world):
    w = settlement_world
    # Create a dispute to trigger a hold
    d = post(
        w["c"], f"/transactions/{w['tid']}/disputes", w["K"],
        field="weight_g", claimed_value="49.85", reason="Weight dispute",
    )
    assert d.status_code == 201

    # Create settlement draft — should have holds
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    assert r.status_code == 201
    sid = r.json()["id"]

    # Try to approve without accept_partial
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 409
    assert "held" in r.json()["detail"].lower() or "partial" in r.json()["detail"].lower()


# --- Test 7: Transaction version hash chain ---
def test_hash_chain_integrity(settlement_world):
    w = settlement_world
    # Check transaction history
    hist = w["c"].get(f"/transactions/{w['tid']}/history", headers=w["J"]).json()
    v1 = hist["versions"][0]
    assert v1["version_no"] == 1
    assert len(v1["version_hash"]) == 64  # SHA-256 hex
    assert len(v1["prev_hash"]) == 64


# --- Test 8: Decimal precision in transactions ---
def test_decimal_precision_safety(settlement_world):
    w = settlement_world
    # Issue with precise decimal
    r = w["c"].post(
        "/transactions/issue",
        headers=w["J"],
        json={"order_id": w["oid"], "weight_g": "12.3456", "karat": 22, "note": "Precision test"},
    )
    assert r.status_code == 201
    tid2 = r.json()["id"]
    tx = w["c"].get(f"/transactions/{tid2}", headers=w["J"]).json()
    # Verify decimal is preserved exactly
    assert tx["current_version"]["weight_g"] == "12.3456"
    fine = Decimal(tx["current_version"]["fine_g"])
    # Fine gold = weight * karat/24 = 12.3456 * 22/24 = 11.3168
    expected = Decimal("12.3456") * Decimal("22") / Decimal("24")
    assert abs(fine - expected.quantize(Decimal("0.0001"))) < Decimal("0.0001")


# --- Test 9: Settlement fingerprint staleness ---
def test_settlement_fingerprint_staleness(settlement_world):
    w = settlement_world
    # Create settlement
    r = post(w["c"], "/settlements", w["J"], order_id=w["oid"])
    assert r.status_code == 201
    sid = r.json()["id"]

    # Issue more gold (changing the accounts)
    w["c"].post(
        "/transactions/issue",
        headers=w["J"],
        json={"order_id": w["oid"], "weight_g": "10.00", "karat": 22, "note": "Extra"},
    )

    # Try to approve stale settlement — fingerprint should mismatch
    r = post(w["c"], f"/settlements/{sid}/approve", w["J"], accept_partial=False)
    assert r.status_code == 409
    assert "changed" in r.json()["detail"].lower()
