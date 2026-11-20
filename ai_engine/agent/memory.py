"""Scoped case memory for historical job references.
Stores and queries historical wastage and delivery statistics by design and karat.
Strictly isolates data to prevent cross-shop information leakage.
"""

from decimal import Decimal
import statistics

class CaseMemory:
    def __init__(self):
        # In-memory store: (jeweller_id, karigar_id, order_type, karat) -> list of historical wastage_pct
        self._store: dict[tuple[int, int, str, int], list[Decimal]] = {}

    def record_job_outcome(
        self,
        jeweller_id: int,
        karigar_id: int,
        order_type: str,
        karat: int,
        wastage_pct: Decimal
    ) -> None:
        key = (jeweller_id, karigar_id, order_type.lower().strip(), karat)
        if key not in self._store:
            self._store[key] = []
        self._store[key].append(wastage_pct)

    def suggest_wastage_range(
        self,
        jeweller_id: int,
        karigar_id: int,
        order_type: str,
        karat: int
    ) -> tuple[Decimal, Decimal, int] | None:
        """Returns (min_wastage, max_wastage, sample_count) or None if no prior data."""
        key = (jeweller_id, karigar_id, order_type.lower().strip(), karat)
        records = self._store.get(key, [])
        if not records:
            return None
        return min(records), max(records), len(records)
