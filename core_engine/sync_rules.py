"""Offline synchronization rules and conflict validation.

Ensures offline actions replay safely without overwriting accepted records,
detects duplicate idempotency keys, and flags version conflicts.
"""

from typing import Any

def validate_sync_item(item: dict[str, Any]) -> tuple[bool, str | None]:
    """Validates that a queued offline action has required structure."""
    if not isinstance(item, dict):
        return False, "Sync item must be a dictionary"
    if "idempotency_key" not in item or not isinstance(item["idempotency_key"], str):
        return False, "Missing or invalid idempotency_key"
    if len(item["idempotency_key"]) < 8:
        return False, "idempotency_key must be at least 8 characters"
    if "kind" not in item or item["kind"] not in ("dispute_create", "dispute_note"):
        return False, f"Unsupported or missing sync item kind: {item.get('kind')}"
    if "payload" not in item or not isinstance(item["payload"], dict):
        return False, "Missing or invalid payload"
    return True, None

def detect_conflict(
    target_version: int,
    current_server_version: int,
    is_disputed: bool = False
) -> tuple[bool, str | None]:
    """Detects if an offline operation conflicts with current server state."""
    if target_version < current_server_version:
        return True, f"Outdated base version {target_version}; server is at {current_server_version}"
    if is_disputed:
        return True, "Target transaction is already disputed; conflicting action"
    return False, None
