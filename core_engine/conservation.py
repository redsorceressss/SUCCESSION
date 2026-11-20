from dataclasses import dataclass, field
from decimal import Decimal
from .purity import q4

@dataclass(frozen=True)
class Reconciliation:
    issued: Decimal
    returned: Decimal
    agreed_wastage: Decimal
    recovered_scrap: Decimal
    gap_to_explain: Decimal
    unexplained_gap: Decimal
    tolerance: Decimal
    status: str  # "BALANCED" | "WITHIN_TOLERANCE" | "REVIEW" | "NEGATIVE_GAP"
    lines: list = field(default_factory=list)

def reconcile(issued_fine, returned_fine, wastage_pct, scrap_fine, tolerance_g):
    """Issued = Returned + Agreed wastage + Recovered scrap + Unexplained gap (all fine grams)."""
    issued = Decimal(str(issued_fine))
    returned = Decimal(str(returned_fine))
    scrap = Decimal(str(scrap_fine))
    tol = Decimal(str(tolerance_g))
    wastage = q4(issued * Decimal(str(wastage_pct)) / Decimal(100))
    gap_to_explain = q4(issued - returned)
    unexplained = q4(gap_to_explain - wastage - scrap)

    if unexplained == 0:
        status = "BALANCED"
    elif unexplained < 0:
        status = "NEGATIVE_GAP"  # more accounted for than issued: check inputs
    elif unexplained <= tol:
        status = "WITHIN_TOLERANCE"
    else:
        status = "REVIEW"  # a question for both parties, never an accusation

    lines = [
        f"Issued (fine): {issued} g",
        f"Returned (fine): {returned} g",
        f"Gap to explain: {gap_to_explain} g",
        f"Agreed wastage ({wastage_pct}%): {wastage} g",
        f"Recovered scrap: {scrap} g",
        f"Unexplained gap: {unexplained} g [{status}]",
    ]
    return Reconciliation(
        issued, returned, wastage, scrap, gap_to_explain, unexplained, tol, status, lines
    )
