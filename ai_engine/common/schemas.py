"""Shared schemas for AI/ML modules."""

from decimal import Decimal
from pydantic import BaseModel, Field

class ExtractedEntry(BaseModel):
    karigar: str | None = None
    weight_g: str | None = None
    karat: int | None = None
    order_ref: str | None = None
    due_date: str | None = None
    kind: str = "issue"

class ScaleReadingResult(BaseModel):
    value: str | None = None
    status: str  # MATCH | MISMATCH | UNREADABLE
    entered_g: str
    tolerance_g: str
    needs_manual_confirm: bool = False
    disclaimer: str = "SIMPLIFIED reading. It shows what the scale displayed, not the gold's purity."
