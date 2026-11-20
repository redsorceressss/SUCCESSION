from decimal import Decimal, ROUND_HALF_UP

Q4 = Decimal("0.0001")  # internal precision: 4 decimal places (0.1 mg)

def q4(x: Decimal) -> Decimal:
    """Quantize to 4 decimal places using ROUND_HALF_UP."""
    return x.quantize(Q4, rounding=ROUND_HALF_UP)

def fine_gold(weight_g: str | Decimal, karat: int | str | Decimal) -> Decimal:
    """Fine-gold grams = weight x karat / 24. Always pass strings or Decimal, never floats."""
    w = Decimal(str(weight_g))
    k = Decimal(str(karat))
    if w < 0:
        raise ValueError("weight cannot be negative")
    if not (Decimal(1) <= k <= Decimal(24)):
        raise ValueError("karat must be between 1 and 24")
    return q4(w * k / Decimal(24))
