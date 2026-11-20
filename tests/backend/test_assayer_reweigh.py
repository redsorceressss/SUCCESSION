"""Phase 6 P0-A: Independent assayer role enforcement for reweigh verification.

Tests cover all 12 required scenarios:
1. Assayer can register
2. Assayer cannot create orders (not a party)
3. Assayer cannot confirm transactions
4. Assayer CAN record reweigh results
5. Assayer CAN verify reweigh results
6. Interested party (jeweller of the order) CANNOT verify
7. Interested party (karigar of the order) CANNOT verify
8. Requester CANNOT record their own reweigh result
9. Measurement operator CANNOT also verify the result
10. Double verification is prevented
11. Verification before result is prevented
12. Assayer independence from order parties is enforced
"""

import pytest
from tests.conftest import login_headers, register


def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)


@pytest.fixture
def dispute_world(client, db_session):
    """Extended world with an assayer and a dispute with reweigh request."""
    register(client, "jeweller1", "jeweller", "Mehta Jewellers")
    register(client, "karigar1", "karigar", "Ramesh Karigar")
    register(client, "assayer1", "assayer", "Neutral Assay Lab")
    register(client, "assayer2", "assayer", "City Assay Bureau")

    J = login_headers(client, "jeweller1")
    K = login_headers(client, "karigar1")
    A1 = login_headers(client, "assayer1")
    A2 = login_headers(client, "assayer2")

    # Create order
    r = client.post(
        "/orders",
        headers=J,
        json={
            "karigar_login": "karigar1",
            "description": "22K Bangles",
            "due_date": "2026-12-01",
            "wastage_pct": "1.5",
        },
    )
    assert r.status_code == 201, r.text
    oid = r.json()["id"]

    # Issue gold
    r = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "50.00", "karat": 22, "note": "Bangles gold"},
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    # Karigar opens dispute on weight
    d = post(
        client,
        f"/transactions/{tid}/disputes",
        K,
        field="weight_g",
        claimed_value="49.85",
        reason="Scale reads 49.85",
    ).json()
    assert d["state"] == "OPEN"

    # Get the auto-created reweigh request
    full = client.get(f"/disputes/{d['id']}", headers=K).json()
    rw_id = full["reweigh_requests"][0]["id"]

    # Explicit assayer assignment required for assayer workflow actions/evidence access
    a = client.post(
        f"/disputes/{d['id']}/assayer-assignments",
        headers=J,
        json={"assayer_login": "assayer1", "note": "Assigned for independent reweigh"},
    )
    assert a.status_code == 201

    return {
        "c": client,
        "db": db_session,
        "J": J,
        "K": K,
        "A1": A1,
        "A2": A2,
        "oid": oid,
        "tid": tid,
        "did": d["id"],
        "rw_id": rw_id,
    }


# --- Test 1: Assayer can register ---
def test_assayer_can_register(client, db_session):
    r = client.post(
        "/auth/register",
        json={"login": "assay_test", "name": "Test Assayer", "password": "TestPass123!", "role": "assayer"},
    )
    assert r.status_code == 201
    assert r.json()["role"] == "assayer"


# --- Test 2: Assayer cannot create orders ---
def test_assayer_cannot_create_orders(dispute_world):
    w = dispute_world
    r = w["c"].post(
        "/orders",
        headers=w["A1"],
        json={"karigar_login": "karigar1", "description": "Test", "due_date": "2026-12-01", "wastage_pct": "0"},
    )
    assert r.status_code == 403


# --- Test 3: Assayer cannot confirm transactions ---
def test_assayer_cannot_confirm_transactions(dispute_world):
    w = dispute_world
    r = post(w["c"], f"/transactions/{w['tid']}/confirm", w["A1"], version_no=1)
    assert r.status_code == 403


# --- Test 4: Assayer CAN record reweigh results ---
def test_assayer_can_record_reweigh_result(dispute_world):
    w = dispute_world
    r = post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.90")
    assert r.status_code == 200
    assert r.json()["status"] == "DONE"
    assert r.json()["result_weight_g"] == "49.9000"


# --- Test 5: Assayer CAN verify reweigh results ---
def test_assayer_can_verify_reweigh_result(dispute_world):
    w = dispute_world
    # First record result (by A1)
    post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    # Assign A2 for independent verification
    a2 = w["c"].post(
        f"/disputes/{w['did']}/assayer-assignments",
        headers=w["J"],
        json={"assayer_login": "assayer2", "note": "Independent verifier"},
    )
    assert a2.status_code == 201
    # Then verify by different assayer (A2)
    r = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["A2"],
        json={"verified_weight_g": "49.85"},
    )
    assert r.status_code == 200
    assert r.json()["assayer_verified"] is True
    assert r.json()["weights_match"] is True


# --- Test 6: Jeweller (interested party) CANNOT verify ---
def test_jeweller_cannot_verify_reweigh(dispute_world):
    w = dispute_world
    post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    r = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["J"],
        json={"verified_weight_g": "49.85"},
    )
    assert r.status_code == 403


# --- Test 7: Karigar (interested party) CANNOT verify ---
def test_karigar_cannot_verify_reweigh(dispute_world):
    w = dispute_world
    post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    r = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["K"],
        json={"verified_weight_g": "49.85"},
    )
    assert r.status_code == 403


# --- Test 8: Requester CANNOT record their own reweigh result ---
def test_requester_cannot_record_own_result(dispute_world):
    """The karigar who requested the reweigh (via dispute auto-creation) cannot record the result."""
    w = dispute_world
    # The auto-created reweigh was requested_by=karigar1 (who raised the dispute)
    r = post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["K"], weight_g="49.85")
    assert r.status_code == 403
    assert "requester" in r.json()["detail"].lower()


# --- Test 9: Measurement operator CANNOT also verify ---
def test_operator_cannot_also_verify(dispute_world):
    w = dispute_world
    # A1 records the result
    post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    # A1 tries to verify their own measurement
    r = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["A1"],
        json={"verified_weight_g": "49.85"},
    )
    assert r.status_code == 403
    assert "operator" in r.json()["detail"].lower() or "verify" in r.json()["detail"].lower()


# --- Test 10: Double verification is prevented ---
def test_double_verification_prevented(dispute_world):
    w = dispute_world
    post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    a2 = w["c"].post(
        f"/disputes/{w['did']}/assayer-assignments",
        headers=w["J"],
        json={"assayer_login": "assayer2", "note": "Independent verifier"},
    )
    assert a2.status_code == 201
    # First verification by A2
    r1 = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["A2"],
        json={"verified_weight_g": "49.85"},
    )
    assert r1.status_code == 200
    # Second verification attempt
    r2 = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["A2"],
        json={"verified_weight_g": "49.85"},
    )
    assert r2.status_code == 409


# --- Test 11: Verification before result is prevented ---
def test_verification_before_result_prevented(dispute_world):
    w = dispute_world
    r = w["c"].post(
        f"/reweighing-requests/{w['rw_id']}/verify",
        headers=w["A1"],
        json={"verified_weight_g": "49.85"},
    )
    assert r.status_code == 409
    assert "not been completed" in r.json()["detail"]


# --- Test 12: Reweigh result immutability ---
def test_reweigh_result_immutability(dispute_world):
    w = dispute_world
    # Record result
    r1 = post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["A1"], weight_g="49.85")
    assert r1.status_code == 200
    # Try to overwrite
    r2 = post(w["c"], f"/reweighing-requests/{w['rw_id']}/result", w["J"], weight_g="50.00")
    assert r2.status_code == 409
