"""Core Engine: Pure Python gold-accounting and cryptographic integrity functions.

Independent of backend and AI engines; uses exact Decimal calculations throughout.
"""

from .purity import fine_gold, q4, Q4
from .conservation import reconcile, Reconciliation
from .disputes import split_disputed, settleable
from .integrity import canonical, entry_hash, verify_chain, GENESIS
from .sync_rules import validate_sync_item, detect_conflict
from .qr_payload import build_qr_handshake, verify_qr_handshake

__all__ = [
    "fine_gold",
    "q4",
    "Q4",
    "reconcile",
    "Reconciliation",
    "split_disputed",
    "settleable",
    "canonical",
    "entry_hash",
    "verify_chain",
    "GENESIS",
    "validate_sync_item",
    "detect_conflict",
    "build_qr_handshake",
    "verify_qr_handshake",
]
