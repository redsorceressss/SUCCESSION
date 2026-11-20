"""Agent reconciliation explanations.
Renders transparent, human-readable explanations of conservation calculations.
"""

def explain_reconciliation(rec_result: dict) -> str:
    lines = rec_result.get("lines", [])
    status = rec_result.get("status", "UNKNOWN")
    summary = "\n".join(lines)
    if status == "REVIEW":
        summary += (
            "\nNote: The unexplained gap is above the normal tolerance band. "
            "Please review scale photos and scrap receipts together."
        )
    return summary
