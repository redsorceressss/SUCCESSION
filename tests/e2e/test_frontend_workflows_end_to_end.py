"""End-to-End Business Workflow Verification
Validates all 12 critical user workflows against the FastAPI backend using isolated in-memory DB.
Zero mutation of development swarn.db.
"""

from decimal import Decimal
import io
import pytest
from fastapi.testclient import TestClient
from tests.conftest import register, login_headers, PNG

def test_workflow_01_registration_and_login(client: TestClient):
    """1. Registration and Login Workflow"""
    # Register jeweller
    reg = register(client, "test_jeweller_e2e", "jeweller", "E2E Jeweller", "StrongPass123!")
    assert reg["login"] == "test_jeweller_e2e"
    assert reg["role"] == "jeweller"

    # Login
    auth_headers = login_headers(client, "test_jeweller_e2e", "StrongPass123!")
    assert "Authorization" in auth_headers
    assert auth_headers["Authorization"].startswith("Bearer ")

    # Verify /me endpoint
    me_res = client.get("/me", headers=auth_headers)
    assert me_res.status_code == 200
    assert me_res.json()["login"] == "test_jeweller_e2e"

def test_workflow_02_order_lifecycle(client: TestClient, world):
    """2. Order Creation & Order Details Workflow"""
    J, K1, oid = world["J"], world["K1"], world["oid"]

    # Get order detail
    res = client.get(f"/orders/{oid}", headers=J)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == oid
    assert data["description"] == "22K Haar"
    assert Decimal(data["wastage_pct"]) == Decimal("2.000")

    # Get order summary (conservation check)
    summary_res = client.get(f"/orders/{oid}/summary", headers=J)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "reconciliation" in summary
    assert "status" in summary["reconciliation"]
    assert "issued_fine_g" in summary

def test_workflow_03_and_04_issue_and_confirmation(client: TestClient, world):
    """3. Gold issue transaction & 4. Karigar confirmation"""
    J, K1, oid = world["J"], world["K1"], world["oid"]

    # Issue a second transaction: 10.00g at 22K
    issue_res = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "10.0000", "karat": 22, "note": "Supplementary bar"},
    )
    assert issue_res.status_code == 201
    tx = issue_res.json()
    tx_id = tx["id"]
    assert tx["state"] == "AWAITING_CONFIRMATION"

    # Karigar confirms
    v_no = tx["current_version"]["version_no"] if isinstance(tx["current_version"], dict) else tx["current_version"]
    confirm_res = client.post(
        f"/transactions/{tx_id}/confirm",
        headers=K1,
        json={"version_no": v_no},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["state"] == "CONFIRMED_BY_BOTH"

def test_workflow_05_request_correction(client: TestClient, world):
    """5. Request Correction Workflow"""
    J, K1, oid = world["J"], world["K1"], world["oid"]

    # Issue 20.00g
    issue_res = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "20.0000", "karat": 22, "note": "Typo test"},
    )
    tx_id = issue_res.json()["id"]

    # Karigar requests correction on weight_g
    corr_res = client.post(
        f"/transactions/{tx_id}/correction-requests",
        headers=K1,
        json={"field": "weight_g", "proposed_value": "20.1000", "reason": "Gross weight typo"},
    )
    assert corr_res.status_code == 201
    cr_id = corr_res.json()["id"]

    # Jeweller accepts correction
    decide_res = client.post(
        f"/correction-requests/{cr_id}/decide",
        headers=J,
        json={"decision": "accept", "reason": "Agreed, typo corrected"},
    )
    assert decide_res.status_code == 200
    assert decide_res.json()["status"] == "ACCEPTED"
    tx_updated = decide_res.json()["transaction"]
    cur_ver = tx_updated["current_version"] if isinstance(tx_updated["current_version"], dict) else {}
    assert cur_ver.get("weight_g") == "20.1000"
    assert tx_updated["state"] == "CONFIRMED_BY_BOTH"

def test_workflow_06_and_07_raise_dispute_and_evidence(client: TestClient, world):
    """6. Raise Dispute & 7. Add Evidence Workflow"""
    J, K1, oid = world["J"], world["K1"], world["oid"]

    # Issue 50.00g
    issue_res = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "50.0000", "karat": 22, "note": "Dispute candidate"},
    )
    tx_id = issue_res.json()["id"]

    # Karigar raises dispute: scale weighed 49.85g
    disp_res = client.post(
        f"/transactions/{tx_id}/disputes",
        headers=K1,
        json={
            "field": "weight_g",
            "claimed_value": "49.8500",
            "reason": "Scale calibrated with M1 50g weight showed 49.8500g",
        },
    )
    assert disp_res.status_code == 201
    dispute = disp_res.json()
    disp_id = dispute["id"]
    assert dispute["field"] == "weight_g"
    assert dispute["claimed_value"] == "49.8500"
    assert dispute["original_value"] == "50.0000"
    assert dispute["held_g"] == "0.1500"

    # Add dispute note
    note_res = client.post(
        f"/disputes/{disp_id}/notes",
        headers=J,
        json={"text": "Verified with jeweller calibration certificate."},
    )
    assert note_res.status_code == 201

    # Upload evidence file
    file_bytes = io.BytesIO(PNG)
    ev_res = client.post(
        f"/disputes/{disp_id}/evidence",
        headers=K1,
        files={"file": ("scale_reading.png", file_bytes, "image/png")},
    )
    assert ev_res.status_code == 201
    ev_data = ev_res.json()
    assert "sha256" in ev_data
    assert ev_data["mime"] == "image/png"

def test_workflow_08_reweighing(client: TestClient, world):
    """8. Reweighing Workflow"""
    J, K1, oid = world["J"], world["K1"], world["oid"]

    # Issue and dispute
    tx_id = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "50.0000", "karat": 22},
    ).json()["id"]
    disp_id = client.post(
        f"/transactions/{tx_id}/disputes",
        headers=K1,
        json={"field": "weight_g", "claimed_value": "49.8500", "reason": "Diff"},
    ).json()["id"]

    # Request reweigh
    rw_req = client.post(
        f"/disputes/{disp_id}/reweighing-requests",
        headers=J,
        json={"note": "Joint reweigh at chamber vault"},
    )
    assert rw_req.status_code == 201
    rid = rw_req.json()["id"]

    # Submit reweigh result
    rw_res = client.post(
        f"/reweighing-requests/{rid}/result",
        headers=K1,
        json={"weight_g": "49.9200"},
    )
    assert rw_res.status_code == 200
    assert rw_res.json()["status"] == "DONE"
    assert rw_res.json()["result_weight_g"] == "49.9200"

def test_workflow_09_passbook_and_history(client: TestClient, world):
    """9. Passbook & Transaction History Workflow"""
    J, K1 = world["J"], world["K1"]
    karigar_user = client.get("/me", headers=K1).json()
    kid = karigar_user["id"]

    # Get passbook
    pb_res = client.get(f"/passbook/{kid}", headers=K1)
    assert pb_res.status_code == 200
    pb = pb_res.json()
    assert "totals" in pb
    assert "orders" in pb

    # History of initial transaction
    tid = world["tid"]
    hist_res = client.get(f"/transactions/{tid}/history", headers=J)
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert "versions" in hist
    assert "confirmations" in hist

def test_workflow_10_settlement_and_partial_settlement(client: TestClient, world):
    """10. Settlement and Partial Settlement Dual-Approval Workflow"""
    J, K1, oid, tid = world["J"], world["K1"], world["oid"], world["tid"]

    # Confirm initial issue so order has confirmed entries
    tx = client.get(f"/transactions/{tid}", headers=J).json()
    client.post(f"/transactions/{tid}/confirm", headers=K1, json={"version_no": tx["current_version"]})

    # Return gold: 47.10g finished + 1.45g scrap
    client.post(
        "/transactions/return",
        headers=K1,
        json={"order_id": oid, "weight_g": "47.1000", "karat": 22, "scrap_g": "1.4500"},
    )
    # Confirm return
    tx_ret = client.get(f"/transactions?order_id={oid}", headers=J).json()[-1]
    client.post(f"/transactions/{tx_ret['id']}/confirm", headers=J, json={"version_no": tx_ret["current_version"]})

    # Draft settlement
    st_res = client.post("/settlements", headers=J, json={"order_id": oid})
    assert st_res.status_code == 201
    sid = st_res.json()["id"]

    # Jeweller approves
    app_j = client.post(f"/settlements/{sid}/approve", headers=J, json={"accept_partial": False})
    assert app_j.status_code == 200

    # Karigar approves -> settlement finalized
    app_k = client.post(f"/settlements/{sid}/approve", headers=K1, json={"accept_partial": False})
    assert app_k.status_code == 200
    assert app_k.json()["state"] == "APPROVED"

def test_workflow_11_and_12_notifications_and_rbac(client: TestClient, world):
    """11. Notifications and 12. Role-specific permissions"""
    J, K1, K2, oid = world["J"], world["K1"], world["K2"], world["oid"]

    # Notifications check
    notif_res = client.get("/notifications", headers=K1)
    assert notif_res.status_code == 200
    assert isinstance(notif_res.json(), list)

    # RBAC: Karigar cannot issue raw gold
    unauth_issue = client.post(
        "/transactions/issue",
        headers=K1,
        json={"order_id": oid, "weight_g": "10.0000", "karat": 22},
    )
    assert unauth_issue.status_code == 403

    # RBAC: Karigar 2 cannot view Order 1 (isolation)
    isolated_order = client.get(f"/orders/{oid}", headers=K2)
    assert isolated_order.status_code == 403

    # RBAC: Karigar 2 cannot view Karigar 1's passbook
    k1_user = client.get("/me", headers=K1).json()
    isolated_pb = client.get(f"/passbook/{k1_user['id']}", headers=K2)
    assert isolated_pb.status_code == 403
