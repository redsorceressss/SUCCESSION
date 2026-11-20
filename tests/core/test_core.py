"""Tests for core_engine: pure Python gold calculations, disputes, hash-chain, and sync."""

from decimal import Decimal
import pytest
from core_engine.purity import fine_gold, q4
from core_engine.conservation import reconcile
from core_engine.disputes import split_disputed, settleable
from core_engine.integrity import canonical, entry_hash, verify_chain, GENESIS
from core_engine.sync_rules import validate_sync_item, detect_conflict
from core_engine.qr_payload import build_qr_handshake, verify_qr_handshake

def test_fine_gold_valid():
    # 50g at 22K = 50 * 22 / 24 = 45.833333... -> 45.8333
    assert fine_gold("50.00", 22) == Decimal("45.8333")
    assert fine_gold(Decimal("50.00"), 24) == Decimal("50.0000")
    assert fine_gold("100.00", 18) == Decimal("75.0000")

def test_fine_gold_invalid():
    with pytest.raises(ValueError, match="negative"):
        fine_gold("-10", 22)
    with pytest.raises(ValueError, match="karat"):
        fine_gold("50", 0)
    with pytest.raises(ValueError, match="karat"):
        fine_gold("50", 25)

def test_conservation_worked_example():
    """Worked example from Handbook:
    Issued: 50.00 g
    Returned: 47.10 g
    Agreed wastage: 1.00 g (2% of 50.00)
    Recovered scrap: 1.45 g
    Gap to explain: 50.00 - 47.10 = 2.90 g
    Unexplained gap: 2.90 - 1.00 - 1.45 = 0.45 g
    Tolerance: 0.20 g -> status: REVIEW
    """
    rec = reconcile(
        issued_fine="50.00",
        returned_fine="47.10",
        wastage_pct="2.0",
        scrap_fine="1.45",
        tolerance_g="0.20",
    )
    assert rec.issued == Decimal("50.00")
    assert rec.returned == Decimal("47.10")
    assert rec.agreed_wastage == Decimal("1.0000")
    assert rec.recovered_scrap == Decimal("1.45")
    assert rec.gap_to_explain == Decimal("2.9000")
    assert rec.unexplained_gap == Decimal("0.4500")
    assert rec.status == "REVIEW"
    assert len(rec.lines) == 6

def test_conservation_statuses():
    # BALANCED
    rec1 = reconcile("50.00", "48.00", "2.0", "1.00", "0.20")
    # wastage = 1.00, gap = 2.00, unexplained = 2.00 - 1.00 - 1.00 = 0.00
    assert rec1.status == "BALANCED"

    # WITHIN_TOLERANCE
    rec2 = reconcile("50.00", "47.90", "2.0", "1.00", "0.20")
    # gap = 2.10, wastage = 1.00, scrap = 1.00 -> unexplained = 0.10 <= 0.20
    assert rec2.status == "WITHIN_TOLERANCE"

    # NEGATIVE_GAP
    rec3 = reconcile("50.00", "49.00", "2.0", "1.00", "0.20")
    # gap = 1.00, wastage = 1.00, scrap = 1.00 -> unexplained = -1.00
    assert rec3.status == "NEGATIVE_GAP"

def test_dispute_split():
    # Jeweller: 50.00, Karigar: 49.85 -> Undisputed: 49.85, Held: 0.15
    undisputed, held = split_disputed("50.00", "49.85")
    assert undisputed == Decimal("49.8500")
    assert held == Decimal("0.1500")

    # Symmetric when karigar claims more
    undisputed2, held2 = split_disputed("49.85", "50.00")
    assert undisputed2 == Decimal("49.8500")
    assert held2 == Decimal("0.1500")

def test_settleable():
    # When no dispute
    u, h = settleable("50.00", "50.00", partial_settlement_approved_by_both=False)
    assert u == Decimal("50.0000")
    assert h == Decimal("0.0000")

    # When disputed, but partial not approved
    u, h = settleable("50.00", "49.85", partial_settlement_approved_by_both=False)
    assert u == Decimal("0.0000")
    assert h == Decimal("0.1500")

    # When disputed, and partial IS approved
    u, h = settleable("50.00", "49.85", partial_settlement_approved_by_both=True)
    assert u == Decimal("49.8500")
    assert h == Decimal("0.1500")

def test_hash_chain_and_tampering():
    e1 = {"tx_id": 1, "weight": "50.00"}
    h1 = entry_hash(GENESIS, e1)

    e2 = {"tx_id": 1, "confirmed_by": 2}
    h2 = entry_hash(h1, e2)

    chain = [
        {"payload": e1, "prev_hash": GENESIS, "hash": h1},
        {"payload": e2, "prev_hash": h1, "hash": h2},
    ]

    ok, bad_idx = verify_chain(chain)
    assert ok is True
    assert bad_idx is None

    # Tamper with e1 payload
    tampered_chain = [
        {"payload": {"tx_id": 1, "weight": "49.00"}, "prev_hash": GENESIS, "hash": h1},
        {"payload": e2, "prev_hash": h1, "hash": h2},
    ]
    ok_tampered, bad_idx_tampered = verify_chain(tampered_chain)
    assert ok_tampered is False
    assert bad_idx_tampered == 0

def test_sync_rules():
    valid_item = {
        "idempotency_key": "client-uuid-12345",
        "kind": "dispute_create",
        "payload": {"transaction_id": 1},
    }
    ok, err = validate_sync_item(valid_item)
    assert ok is True
    assert err is None

    bad_item = {"idempotency_key": "short", "kind": "invalid"}
    ok, err = validate_sync_item(bad_item)
    assert ok is False

    is_conflict, reason = detect_conflict(target_version=1, current_server_version=2)
    assert is_conflict is True
    assert "Outdated" in reason

def test_qr_payload():
    payload_str = build_qr_handshake(
        transaction_id=1,
        version_no=1,
        version_hash="abcdef123456",
        user_id=2,
        role="karigar",
    )
    ok, data, err = verify_qr_handshake(payload_str)
    assert ok is True
    assert data["tx"] == 1
    assert data["vh"] == "abcdef123456"
    assert data["r"] == "karigar"

def test_shared_hash_vectors():
    import json
    from pathlib import Path
    vec_path = Path(__file__).resolve().parents[1] / "vectors" / "hash_vectors.json"
    vectors = json.loads(vec_path.read_text(encoding="utf-8"))
    for v in vectors:
        c_bytes = canonical(v["payload"])
        assert c_bytes.decode("utf-8") == v["canonical_json"]
        calc_hash = entry_hash(v["prev_hash"], v["payload"])
        assert calc_hash == v["expected_hash"]

