"""Agent settlement draft formatting helpers."""

from .gateway import Gateway

def prepare_settlement_draft(gw: Gateway, order_id: int) -> dict:
    """Invokes backend to draft settlement with proper permissions and returns formatted draft."""
    return gw.draft_settlement(order_id)
