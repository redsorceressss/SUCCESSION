"""Request bodies (what clients may send). Pydantic validates them before code runs.
Weights are Decimal and travel as JSON *strings* ("49.85"). Responses are built in the
serializer helpers in services/common.py, which turn every Decimal into a string again.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, Field

Weight = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=4)]
Grams0 = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=4)]
Karat = Annotated[int, Field(ge=1, le=24)]
Field_ = Literal["weight_g", "karat", "scrap_g", "note"]

class RegisterIn(BaseModel):
    login: str = Field(min_length=3, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["jeweller", "karigar", "assayer"]  # "agent" accounts are created by a script only
    language: str = Field(default="en", max_length=10)

class LoginIn(BaseModel):
    login: str
    password: str

class OrderIn(BaseModel):
    karigar_login: str
    description: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    wastage_pct: Annotated[Decimal, Field(ge=0, le=20, max_digits=6, decimal_places=3)] = Decimal("0")

class IssueIn(BaseModel):
    order_id: int
    weight_g: Weight
    karat: Karat
    note: str = Field(default="", max_length=300)
    client_id: str | None = Field(default=None, max_length=64)  # idempotency key from the phone

class ReturnIn(IssueIn):
    scrap_g: Grams0 = Decimal("0")  # fine-gold grams recovered (refiner assay: SIMULATED in prototype)

class ConfirmIn(BaseModel):
    version_no: int

class CorrectionIn(BaseModel):
    field: Field_
    proposed_value: str = Field(min_length=1, max_length=300)
    reason: str = Field(default="", max_length=300)

class DecisionIn(BaseModel):
    decision: Literal["accept", "reject"]
    reason: str = Field(default="", max_length=300)

class DisputeIn(BaseModel):
    field: Field_
    claimed_value: str = Field(min_length=1, max_length=300)
    reason: str = Field(default="", max_length=500)
    client_id: str | None = Field(default=None, max_length=64)
    evidence_refs: list[str] = Field(default_factory=list)

class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    client_id: str | None = Field(default=None, max_length=64)  # idempotency key for offline-queued notes

class ReweighIn(BaseModel):
    note: str = Field(default="", max_length=300)

class ReweighResultIn(BaseModel):
    weight_g: Weight

class ReweighVerifyIn(BaseModel):
    """Independent assayer verification of a reweigh result."""
    verified_weight_g: Weight
    note: str = Field(default="", max_length=500)

class AssayerAssignmentIn(BaseModel):
    """Assign an assayer to a dispute for independent verification."""
    assayer_login: str = Field(min_length=3, max_length=80)
    note: str = Field(default="", max_length=300)

class AssayerAssignmentRevokeIn(BaseModel):
    reason: str = Field(default="", max_length=300)

class ResolutionIn(BaseModel):
    outcome: Literal["AGREED_VALUE", "ORIGINAL_STANDS"]
    agreed_value: str | None = None
    note: str = Field(default="", max_length=500)

class SettlementIn(BaseModel):
    order_id: int

class ApproveIn(BaseModel):
    accept_partial: bool = False

class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=300)

class VoiceIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    language: str = "auto"

class SyncItem(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=80)
    kind: Literal["dispute_create", "dispute_note"]
    payload: dict

class SyncIn(BaseModel):
    items: list[SyncItem] = Field(max_length=100)

class AgentNotifyIn(BaseModel):
    user_id: int
    kind: str = Field(max_length=30)
    message: str = Field(max_length=500)
    dedupe_key: str | None = Field(default=None, max_length=80)

class AgentTaskIn(BaseModel):
    kind: str = Field(max_length=30)
    order_id: int | None = None
    summary: str = Field(default="", max_length=4000)
