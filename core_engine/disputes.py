from decimal import Decimal
from .purity import q4

def split_disputed(original_g, claimed_g):
    """Isolate the disputed quantity. Nothing is overwritten: both values stay on record.
    Returns (undisputed_g, held_g). Undisputed = the lower value both sides accept at minimum.
    """
    a, b = Decimal(str(original_g)), Decimal(str(claimed_g))
    return q4(min(a, b)), q4(abs(a - b))

def settleable(original_g, claimed_g, partial_settlement_approved_by_both: bool):
    undisputed, held = split_disputed(original_g, claimed_g)
    if held == 0:
        return undisputed, Decimal("0.0000")
    # the held part is NEVER settleable automatically
    return (undisputed if partial_settlement_approved_by_both else Decimal("0.0000")), held
