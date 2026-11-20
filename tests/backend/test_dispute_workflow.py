"""The 15 dispute and correction workflow rules, numbered 1 to 15."""

import pytest
from tests.conftest import PNG

def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)

def test_rule_01_initial_issue_state(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    tx = c.get(f"/transactions/{tid}", headers=K).json()
    assert tx["state"] == "AWAITING_CONFIRMATION"
    assert tx["current_version"]["weight_g"] == "50.0000"

def test_rule_02_confirmation_flow(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    # Karigar confirms
    r = post(c, f"/transactions/{tid}/confirm", K, version_no=1)
    assert r.status_code == 200
    assert r.json()["state"] == "CONFIRMED_BY_BOTH"

def test_rule_03_and_04_dispute_creation_and_neutral_message(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85", reason="Scale reads 49.85").json()
    assert d["state"] == "OPEN"
    # Exact message required by handbook
    assert d["message"] == (
        "The jeweller entered 50.00 g. The karigar reports 49.85 g. Entry marked disputed; reweighing requested."
    )

def test_rule_05_and_06_original_preserved_and_held_quantity(world):
    c, K, J, tid = world["c"], world["K"], world["J"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()
    assert d["held_g"] == "0.1500"

    # Verify transaction history retains original 50.00g version 1
    hist = c.get(f"/transactions/{tid}/history", headers=K).json()
    assert len(hist["versions"]) == 1
    assert hist["versions"][0]["weight_g"] == "50.0000"

def test_rule_07_dispute_notes(world):
    c, K, J, tid = world["c"], world["K"], world["J"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()

    n1 = post(c, f"/disputes/{d['id']}/notes", K, text="Calibrated scale showed 49.85")
    assert n1.status_code == 201

    n2 = post(c, f"/disputes/{d['id']}/notes", J, text="Counter scale showed 50.00")
    assert n2.status_code == 201

    full = c.get(f"/disputes/{d['id']}", headers=K).json()
    assert len(full["notes"]) == 2

def test_rule_08_evidence_upload(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()
    r = c.post(
        f"/disputes/{d['id']}/evidence",
        headers=K,
        files={"file": ("scale.png", PNG, "image/png")},
    )
    assert r.status_code == 201
    assert r.json()["mime"] == "image/png"

def test_rule_09_reweigh_requests(world):
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()

    # Jeweller requests reweigh at neutral shop
    rw = post(c, f"/disputes/{d['id']}/reweighing-requests", J, note="Weigh at neutral shop counter").json()
    assert rw["status"] == "REQUESTED"

    # Karigar records result
    res = post(c, f"/reweighing-requests/{rw['id']}/result", K, weight_g="49.85")
    assert res.status_code == 200
    assert res.json()["status"] == "DONE"
    assert res.json()["result_weight_g"] == "49.8500"

def test_rule_10_correction_blocked_on_disputed_entry(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85")
    r = post(c, f"/transactions/{tid}/correction-requests", K, field="weight_g", proposed_value="49.85")
    assert r.status_code == 409  # blocked while disputed

def test_rule_11_and_12_resolution_proposal_and_anti_self_approval(world):
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()

    # Jeweller proposes resolution
    prop = post(
        c,
        f"/disputes/{d['id']}/resolution-proposals",
        J,
        outcome="AGREED_VALUE",
        agreed_value="49.85",
        note="Agreed based on reweigh",
    ).json()
    assert prop["status"] == "PROPOSED"

    # Jeweller cannot self-approve their own proposal
    self_decide = post(c, f"/resolution-proposals/{prop['id']}/decide", J, decision="accept")
    assert self_decide.status_code == 403

def test_rule_13_resolution_rejection(world):
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()
    prop = post(
        c,
        f"/disputes/{d['id']}/resolution-proposals",
        J,
        outcome="ORIGINAL_STANDS",
        note="Insisting on original",
    ).json()

    # Karigar rejects proposal
    rej = post(c, f"/resolution-proposals/{prop['id']}/decide", K, decision="reject", reason="Disagree").json()
    assert rej["status"] == "REJECTED"

    # Dispute remains OPEN and hold intact
    d_check = c.get(f"/disputes/{d['id']}", headers=K).json()
    assert d_check["state"] == "OPEN"
    assert d_check["held_g"] == "0.1500"

def test_rule_14_and_15_resolution_approval_releases_hold_and_confirms(world):
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85").json()
    prop = post(
        c,
        f"/disputes/{d['id']}/resolution-proposals",
        J,
        outcome="AGREED_VALUE",
        agreed_value="49.85",
        note="Mutual agreement",
    ).json()

    # Karigar accepts
    acc = post(c, f"/resolution-proposals/{prop['id']}/decide", K, decision="accept").json()
    assert acc["status"] == "APPROVED"
    assert acc["dispute"]["state"] == "RESOLVED"
    assert acc["dispute"]["hold_released"] is True

    # Check transaction state is CONFIRMED_BY_BOTH with version 2 = 49.8500
    tx = c.get(f"/transactions/{tid}", headers=K).json()
    assert tx["state"] == "CONFIRMED_BY_BOTH"
    assert tx["current_version"]["version_no"] == 2
    assert tx["current_version"]["weight_g"] == "49.8500"
