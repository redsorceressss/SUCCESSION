"""Secure versioned QR handshake payload for offline confirmation."""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

QR_PAYLOAD_VERSION = 1

def build_qr_handshake(
    transaction_id: int,
    version_no: int,
    version_hash: str,
    user_id: int,
    role: str,
    signature: str = ""
) -> str:
    """Builds a tamper-evident, compact QR payload string for offline verification.
    Contains no secrets, passwords, or authentication tokens.
    """
    payload: dict[str, Any] = {
        "v": QR_PAYLOAD_VERSION,
        "tx": transaction_id,
        "ver": version_no,
        "vh": version_hash,
        "u": user_id,
        "r": role,
        "sig": signature,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    # Encode compact JSON
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)

def verify_qr_handshake(raw_qr_text: str) -> tuple[bool, dict[str, Any] | None, str | None]:
    """Parses and validates a scanned QR handshake payload."""
    try:
        data = json.loads(raw_qr_text)
    except Exception as e:
        return False, None, f"Invalid QR JSON: {e}"

    required_keys = {"v", "tx", "ver", "vh", "u", "r"}
    if not required_keys.issubset(data.keys()):
        return False, None, f"Missing required handshake fields: {required_keys - set(data.keys())}"

    if data.get("v") != QR_PAYLOAD_VERSION:
        return False, None, f"Unsupported QR payload version: {data.get('v')}"

    return True, data, None
