"""Passbook API contract regression tests.

Authoritative backend passbook response shape consumed by the frontend:
- totals.issued_fine_g, totals.returned_fine_g, totals.recovered_scrap_fine_g,
  totals.gold_in_hand_fine_g, totals.held_in_dispute_g are decimal strings.
- orders entries contain id, description, due_date, status (no fabricated per-order fine totals).
- settlements is a list (appended by route) with id/order_id/state/partial/created_at when present.
"""

from decimal import Decimal

from core_engine.purity import fine_gold, q4


def _assert_decimal_string(value: str) -> Decimal:
    assert isinstance(value, str), f"expected decimal string, got {type(value)!r}: {value!r}"
    # Must be parseable as Decimal and must not rely on float formatting.
    return Decimal(value)


def test_passbook_contract_fields_and_decimal_strings(world):
    c, J, K1, oid, tid = world["c"], world["J"], world["K1"], world["oid"], world["tid"]

    karigar = c.get("/me", headers=K1).json()
    res = c.get(f"/passbook/{karigar['id']}", headers=K1)
    assert res.status_code == 200, res.text
    data = res.json()

    # Top-level contract
    assert data["karigar_id"] == karigar["id"]
    assert isinstance(data["totals"], dict)
    assert isinstance(data["orders"], list)
    assert isinstance(data["entries"], list)
    assert isinstance(data["pending_confirmations"], list)
    assert isinstance(data["disputed_entries"], list)
    assert isinstance(data["settlements"], list)
    assert "spoken_summary" in data

    totals = data["totals"]
    for key in (
        "issued_fine_g",
        "returned_fine_g",
        "recovered_scrap_fine_g",
        "gold_in_hand_fine_g",
        "held_in_dispute_g",
    ):
        assert key in totals, f"missing totals.{key}"

    issued = _assert_decimal_string(totals["issued_fine_g"])
    returned = _assert_decimal_string(totals["returned_fine_g"])
    scrap = _assert_decimal_string(totals["recovered_scrap_fine_g"])
    in_hand = _assert_decimal_string(totals["gold_in_hand_fine_g"])
    held = _assert_decimal_string(totals["held_in_dispute_g"])

    # World fixture creates a 50.00g/22k issue awaiting confirmation; no confirmed entries yet.
    assert tid in data["pending_confirmations"]
    assert issued == Decimal("0")
    assert returned == Decimal("0")
    assert scrap == Decimal("0")
    assert held == Decimal("0")
    assert in_hand == issued - returned

    # Orders in passbook are order records (not fabricated per-order fine totals).
    assert len(data["orders"]) >= 1
    order = next(o for o in data["orders"] if o["id"] == oid)
    assert order["description"] == "22K Haar"
    assert order["due_date"] == "2026-11-20"
    assert order["status"] == "OPEN"
    for unexpected in ("wastage_pct", "issued_fine_g", "returned_fine_g", "recovered_scrap_fine_g"):
        assert unexpected not in order, f"order must not fabricate field {unexpected!r}"


def test_passbook_totals_reflect_confirmed_entries(world):
    c, J, K1, oid, tid = world["c"], world["J"], world["K1"], world["oid"], world["tid"]

    tx = c.get(f"/transactions/{tid}", headers=J).json()
    version_no = tx["current_version"]["version_no"]
    confirm = c.post(f"/transactions/{tid}/confirm", headers=K1, json={"version_no": version_no})
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["state"] == "CONFIRMED_BY_BOTH"

    karigar = c.get("/me", headers=K1).json()
    res = c.get(f"/passbook/{karigar['id']}", headers=K1)
    assert res.status_code == 200, res.text
    totals = res.json()["totals"]

    expected_issued = q4(fine_gold(Decimal("50.00"), 22))
    issued = Decimal(totals["issued_fine_g"])
    returned = Decimal(totals["returned_fine_g"])
    in_hand = Decimal(totals["gold_in_hand_fine_g"])

    assert issued == expected_issued
    assert returned == Decimal("0")
    assert in_hand == expected_issued
    # Precision/format: backend serializes decimals as strings via services.common.s (str of Decimal).
    assert totals["issued_fine_g"] == str(expected_issued)
    assert totals["gold_in_hand_fine_g"] == str(expected_issued)
