"""Compare OCR reading against entered weight using Decimal and a tolerance."""

from decimal import Decimal

def compare_weights(
    reading: Decimal | None,
    entered: Decimal,
    tolerance: Decimal = Decimal("0.01")
) -> str:
    """Returns 'MATCH', 'MISMATCH', or 'UNREADABLE'.
    A mismatch is a question for human review, never an accusation.
    """
    if reading is None:
        return "UNREADABLE"
    return "MATCH" if abs(reading - entered) <= tolerance else "MISMATCH"
