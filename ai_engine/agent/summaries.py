"""Agent summary generators for orders, passbook, and disputes."""

def summarize_passbook_account(issued_g: str, returned_g: str, pending_count: int, dispute_count: int) -> str:
    return (
        f"Account Summary: {issued_g} g fine gold issued, {returned_g} g returned. "
        f"{pending_count} entry/entries pending confirmation, {dispute_count} open dispute(s)."
    )
