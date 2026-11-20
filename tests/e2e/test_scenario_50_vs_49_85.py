"""The mandatory demo scenario, end to end, through the real API.
Verifies the complete 50.00 g vs 49.85 g story.
"""

from decimal import Decimal
from tests.conftest import PNG, make_agent

def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)

def test_the_50_00_versus_49_85_story(world):
    c, db, J, K = world["c"], world["db"], world["J"], world["K"]
    tid = world["tid"]
    oid = world["oid"]
    kid = c.get("/me", headers=K).json()["id"]
    A = make_agent(c, db)

    # 1. The karigar sees the jeweller's entry on his own account and disputes it.
    assert c.get(f"/transactions/{tid}", headers=K).json()["state"] == "AWAITING_CONFIRMATION"
    d = post(
        c,
        f"/transactions/{tid}/disputes",
        K,
        field="weight_g",
        claimed_value="49.85",
        reason="Scale shows 49.85",
    ).json()

    # Exact neutral message verification
    assert d["message"] == (
        "The jeweller entered 50.00 g. The karigar reports 49.85 g. "
        "Entry marked disputed; reweighing requested."
    )

    # 2. Original preserved, shown in both accounts, quantity held.
    for who in (J, K):
        disputes = c.get("/disputes", headers=who).json()
        assert any(x["held_g"] == "0.1500" for x in disputes)

    pb = c.get(f"/passbook/{kid}", headers=K).json()
    assert pb["disputed_entries"] == [tid]
    assert pb["totals"]["held_in_dispute_g"] == "0.1500"

    # 3. Notes, evidence and a reweigh from both sides.
    post(c, f"/disputes/{d['id']}/notes", K, text="Weighed twice on my scale")
    post(c, f"/disputes/{d['id']}/notes", J, text="Mine showed 50.00")

    for who in (K, J):
        c.post(
            f"/disputes/{d['id']}/evidence",
            headers=who,
            files={"file": ("scale.png", PNG, "image/png")},
        )

    rw = post(c, f"/disputes/{d['id']}/reweighing-requests", J, note="Weigh at the neutral shop scale").json()
    post(c, f"/reweighing-requests/{rw['id']}/result", K, weight_g="49.85")

    # 4. The agent drafts a settlement but the disputed amount is excluded and agent cannot approve.
    st = post(c, "/settlements", A, order_id=oid).json()
    assert st["draft"]["included"] == []
    assert st["draft"]["held_g_total"] == "0.1500"

    # Agent cannot approve
    assert c.post(f"/settlements/{st['id']}/approve", headers=A, json={"accept_partial": False}).status_code == 403

    # 5. Humans resolve the dispute mutually
    prop = post(
        c,
        f"/disputes/{d['id']}/resolution-proposals",
        J,
        outcome="AGREED_VALUE",
        agreed_value="49.85",
        note="Agreed on 49.85 g after calibrated reweigh",
    ).json()

    res_decision = post(c, f"/resolution-proposals/{prop['id']}/decide", K, decision="accept").json()
    assert res_decision["status"] == "APPROVED"
    assert res_decision["dispute"]["hold_released"] is True

    # 6. Verify transaction is now confirmed with Version 2 at 49.85g
    tx = c.get(f"/transactions/{tid}", headers=K).json()
    assert tx["state"] == "CONFIRMED_BY_BOTH"
    assert tx["current_version"]["version_no"] == 2
    assert tx["current_version"]["weight_g"] == "49.8500"

    # 7. Check Passbook fine gold balance
    # 49.85g * 22 / 24 = 45.6958g fine gold
    pb_after = c.get(f"/passbook/{kid}", headers=K).json()
    assert pb_after["totals"]["gold_in_hand_fine_g"] == "45.6958"
    assert pb_after["totals"]["held_in_dispute_g"] == "0.0000"
    assert pb_after["disputed_entries"] == []

    # 8. Both parties approve final settlement
    fresh_st = post(c, "/settlements", J, order_id=oid).json()
    assert fresh_st["draft"]["issued_fine_g"] == "45.6958"
    assert fresh_st["draft"]["has_holds"] is False

    post(c, f"/settlements/{fresh_st['id']}/approve", J, accept_partial=False)
    final_st = post(c, f"/settlements/{fresh_st['id']}/approve", K, accept_partial=False).json()
    assert final_st["state"] == "APPROVED"

    # 9. Audit verification passes
    audit_res = c.get("/audit/verify", headers=J).json()
    assert audit_res["ok"] is True
    assert audit_res["first_bad_row"] is None
