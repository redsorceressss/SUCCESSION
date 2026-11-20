"""Validation logic for voice extraction outputs."""

from decimal import Decimal, InvalidOperation

def validate_voice_fields(fields: dict) -> list[str]:
    """Returns list of error messages for parsed fields."""
    errors = []
    if "weight_g" in fields:
        try:
            w = Decimal(fields["weight_g"])
            if w <= Decimal("0"):
                errors.append("Weight must be greater than zero.")
        except (InvalidOperation, TypeError):
            errors.append("Invalid decimal weight format.")

    if "karat" in fields:
        k = fields["karat"]
        if not isinstance(k, int) or not (1 <= k <= 24):
            errors.append("Karat must be an integer between 1 and 24.")

    return errors
