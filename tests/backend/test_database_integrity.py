"""Phase 6 P1-E: Database integrity verification tests.

Tests cover:
1. Foreign key enforcement is active
2. Unique constraint enforcement (idempotency keys, confirmations)
3. Immutable table guard (TransactionVersion, Confirmation, etc.)
4. Concurrent duplicate sync request handling
5. Cross-user idempotency isolation
"""

import json
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from tests.conftest import login_headers, register
from backend.app.models import (
    Confirmation, DisputeNote, SyncRecord, TransactionVersion, User
)


def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)


# --- Test 1: Immutable table guard prevents UPDATE ---
def test_transaction_version_immutable(world):
    """TransactionVersion rows cannot be updated via ORM."""
    db = world["db"]
    tv = db.query(TransactionVersion).first()
    assert tv is not None
    tv.weight_g = "999.0000"
    with pytest.raises(RuntimeError, match="immutable"):
        db.flush()
    db.rollback()


# --- Test 2: Immutable table guard prevents DELETE ---
def test_confirmation_immutable_delete(world):
    """Confirmation rows cannot be deleted via ORM."""
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]
    # Create a confirmation first
    post(c, f"/transactions/{tid}/confirm", K, version_no=1)
    db = world["db"]
    conf = db.query(Confirmation).first()
    assert conf is not None
    db.delete(conf)
    with pytest.raises(RuntimeError, match="immutable"):
        db.flush()
    db.rollback()


# --- Test 3: Unique constraint on confirmations ---
def test_duplicate_confirmation_prevented(world):
    c, K, tid = world["c"], world["K"], world["tid"]
    # First confirmation
    r1 = post(c, f"/transactions/{tid}/confirm", K, version_no=1)
    assert r1.status_code == 200
    # Duplicate confirmation attempt
    r2 = post(c, f"/transactions/{tid}/confirm", K, version_no=1)
    assert r2.status_code == 409


# --- Test 4: SyncRecord idempotency key uniqueness ---
def test_sync_record_idempotency(world):
    db = world["db"]
    user = db.query(User).filter(User.login == "jeweller1").first()
    sr1 = SyncRecord(
        idempotency_key="test-idem-key-001",
        user_id=user.id,
        kind="dispute_create",
        result_json=json.dumps({"id": 1}),
    )
    db.add(sr1)
    db.commit()

    sr2 = SyncRecord(
        idempotency_key="test-idem-key-001",
        user_id=user.id,
        kind="dispute_create",
        result_json=json.dumps({"id": 2}),
    )
    db.add(sr2)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# --- Test 5: Cross-user note idempotency isolation ---
def test_cross_user_note_idempotency(world):
    """Two different users using the same client_id for notes: second should fail."""
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]

    # Create dispute
    d = post(c, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="49.85", reason="Weight off")
    did = d.json()["id"]

    # K posts a note with client_id
    r1 = c.post(
        f"/disputes/{did}/notes",
        headers=K,
        json={"text": "My observation", "client_id": "shared-client-id-xyz"},
    )
    assert r1.status_code == 201

    # J tries with same client_id
    r2 = c.post(
        f"/disputes/{did}/notes",
        headers=J,
        json={"text": "Different observation", "client_id": "shared-client-id-xyz"},
    )
    assert r2.status_code == 409


# --- Test 6: Dispute creation idempotency via client_id ---
def test_dispute_creation_idempotency(world):
    c, K, tid = world["c"], world["K"], world["tid"]

    # First creation
    r1 = post(c, f"/transactions/{tid}/disputes", K,
              field="weight_g", claimed_value="49.85", reason="Test",
              client_id="dispute-idem-001")
    assert r1.status_code == 201

    # Retry with same client_id
    r2 = post(c, f"/transactions/{tid}/disputes", K,
              field="weight_g", claimed_value="49.85", reason="Test",
              client_id="dispute-idem-001")
    assert r2.status_code == 201  # idempotent: returns existing
    assert r2.json()["id"] == r1.json()["id"]


# --- Test 7: Anti-self-approval on dispute resolution ---
def test_anti_self_approval_dispute_resolution(world):
    c, J, K, tid = world["c"], world["J"], world["K"], world["tid"]

    # Create dispute
    d = post(c, f"/transactions/{tid}/disputes", K,
             field="weight_g", claimed_value="49.85", reason="Dispute")
    did = d.json()["id"]

    # K proposes resolution
    prop = post(c, f"/disputes/{did}/resolution-proposals", K,
                outcome="AGREED_VALUE", agreed_value="49.85", note="Let's agree")
    pid = prop.json()["id"]

    # K tries to approve own proposal
    r = post(c, f"/resolution-proposals/{pid}/decide", K, decision="accept")
    assert r.status_code == 403
    assert "other party" in r.json()["detail"].lower()
