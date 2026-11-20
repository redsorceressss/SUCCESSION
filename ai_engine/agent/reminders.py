"""Agent reminder formatting and deduplication key generation."""

from datetime import date

def make_deadline_dedupe_key(order_id: int, current_date: date) -> str:
    return f"due-{order_id}-{current_date.isoformat()}"

def make_dispute_dedupe_key(dispute_id: int, current_date: date) -> str:
    return f"dispute-{dispute_id}-{current_date.isoformat()}"
