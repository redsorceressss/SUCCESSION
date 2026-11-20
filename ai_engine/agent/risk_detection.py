"""Agent risk detection logic.
Identifies potential deadline slips or unexplained variances without ever accusing either party.
"""

from datetime import date
from typing import Any

def identify_order_risks(order_summary: dict[str, Any], current_date: date) -> list[str]:
    risks = []
    due_str = order_summary.get("due_date")
    if due_str and not order_summary.get("has_return"):
        days = (date.fromisoformat(due_str) - current_date).days
        if days < 0:
            risks.append(f"Order is overdue by {abs(days)} day(s) with no recorded return.")
        elif days <= 2:
            risks.append(f"Order delivery date is approaching in {days} day(s).")

    if order_summary.get("disputed_entries", 0) > 0:
        risks.append("Order has open dispute(s) requiring reweighing or mutual review.")

    return risks
