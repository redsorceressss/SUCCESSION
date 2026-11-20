import hashlib
import json

GENESIS = "0" * 64

def canonical(obj) -> bytes:
    """Sorted keys, no spaces, ensure_ascii=False, UTF-8. Decimals must already be strings."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def entry_hash(prev_hash: str, payload: dict) -> str:
    """SHA-256 of previous hash string plus canonical JSON payload."""
    return hashlib.sha256(prev_hash.encode("ascii") + canonical(payload)).hexdigest()

def verify_chain(entries: list[dict]) -> tuple[bool, int | None]:
    """entries: list of {"payload": ..., "prev_hash": ..., "hash": ...}.
    Returns (ok, index_of_first_break).
    """
    prev = GENESIS
    for i, e in enumerate(entries):
        if e["prev_hash"] != prev or entry_hash(prev, e["payload"]) != e["hash"]:
            return False, i
        prev = e["hash"]
    return True, None
