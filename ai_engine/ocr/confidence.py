"""Confidence evaluation and abstention logic for OCR readings."""

from decimal import Decimal, InvalidOperation

def evaluate_reading_confidence(
    reading_str: str | None,
    raw_pattern_score: float = 1.0,
    glare_ratio: float = 0.0,
) -> float:
    """
    Returns confidence score between 0.0 and 1.0.
    Heavily penalizes glare, impossible scale readings, and unparseable patterns.
    """
    if not reading_str:
        return 0.0

    try:
        val = Decimal(reading_str)
        if val <= 0:
            return 0.1
        if val > Decimal("50000.00"):  # Exceeds typical jewellery workshop precision scale range
            return 0.3

        # Base confidence from pattern scoring
        conf = raw_pattern_score

        # Subtract penalty for specular glare
        if glare_ratio > 0.10:
            conf -= min(0.5, glare_ratio * 2.0)

        # Decimal precision check: scales typically have 1, 2, or 3 decimal places
        parts = reading_str.split(".")
        if len(parts) == 2 and len(parts[1]) > 3:
            conf -= 0.3

        return round(max(0.0, min(1.0, conf)), 2)
    except (InvalidOperation, Exception):
        return 0.0

