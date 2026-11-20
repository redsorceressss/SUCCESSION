"""All database tables for SUCCESSION.
Immutable tables (never UPDATE or DELETE rows):
TransactionVersion, Confirmation, DisputeNote, EvidenceFile, SettlementApproval, AuditEvent.
See the guard at the bottom of this file.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, event
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base, DecimalString

def utcnow() -> datetime:
    """Naive UTC time. We keep every timestamp in UTC and convert only in the UI."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # jeweller | karigar | assayer | agent
    language: Mapped[str] = mapped_column(String(10), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    jeweller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    karigar_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    description: Mapped[str] = mapped_column(String(200))
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    wastage_pct: Mapped[Decimal] = mapped_column(DecimalString, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Transaction(Base):
    """Identity of an entry. The numbers live in TransactionVersion, never here."""
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # issue | return
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    state: Mapped[str] = mapped_column(String(30), default="AWAITING_CONFIRMATION", index=True)
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class TransactionVersion(Base):
    __tablename__ = "transaction_versions"
    __table_args__ = (UniqueConstraint("transaction_id", "version_no"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    weight_g: Mapped[Decimal] = mapped_column(DecimalString)
    karat: Mapped[int] = mapped_column(Integer)
    fine_g: Mapped[Decimal] = mapped_column(DecimalString)
    scrap_g: Mapped[Decimal] = mapped_column(DecimalString, default=Decimal("0"))
    note: Mapped[str] = mapped_column(String(300), default="")
    reason: Mapped[str] = mapped_column(String(300), default="")  # why this version exists
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    prev_hash: Mapped[str] = mapped_column(String(64))
    version_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Confirmation(Base):
    __tablename__ = "confirmations"
    __table_args__ = (UniqueConstraint("transaction_id", "version_no", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    version_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class CorrectionRequest(Base):
    __tablename__ = "correction_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    base_version_no: Mapped[int] = mapped_column(Integer)
    field: Mapped[str] = mapped_column(String(20))
    original_value: Mapped[str] = mapped_column(String(300))
    proposed_value: Mapped[str] = mapped_column(String(300))
    reason: Mapped[str] = mapped_column(String(300), default="")
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(12), default="PENDING")  # PENDING|ACCEPTED|REJECTED
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decision_reason: Mapped[str] = mapped_column(String(300), default="")
    resulting_version_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Dispute(Base):
    __tablename__ = "disputes"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)  # the version being disputed
    field: Mapped[str] = mapped_column(String(20))
    original_value: Mapped[str] = mapped_column(String(300))
    claimed_value: Mapped[str] = mapped_column(String(300))
    raised_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(500), default="")
    state: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)  # OPEN|RESOLVED
    evidence_refs: Mapped[str] = mapped_column(Text, default="[]")  # JSON list, filled by offline sync
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class DisputeNote(Base):
    __tablename__ = "dispute_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(ForeignKey("disputes.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    dispute_id: Mapped[int | None] = mapped_column(ForeignKey("disputes.id"), nullable=True, index=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    path: Mapped[str] = mapped_column(String(300))
    mime: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(20), default="evidence")  # evidence | scale_photo
    entered_weight: Mapped[Decimal | None] = mapped_column(DecimalString, nullable=True)
    ocr_reading: Mapped[Decimal | None] = mapped_column(DecimalString, nullable=True)
    ocr_status: Mapped[str] = mapped_column(String(20), default="")  # MATCH|MISMATCH|UNREADABLE
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class ReweighRequest(Base):
    __tablename__ = "reweigh_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(ForeignKey("disputes.id"), index=True)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str] = mapped_column(String(300), default="")
    status: Mapped[str] = mapped_column(String(12), default="REQUESTED")  # REQUESTED | DONE
    result_weight_g: Mapped[Decimal | None] = mapped_column(DecimalString, nullable=True)
    result_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assayer_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    assayer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assayer_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class AssayerAssignment(Base):
    """Explicit, auditable assignment of an assayer to a specific dispute/verification task.
    Mutable by design (status/revocation changes) but every change must be audit-logged.
    """
    __tablename__ = "assayer_assignments"
    __table_args__ = (UniqueConstraint("dispute_id", "assayer_user_id", "status", name="uq_assayer_assignment_dispute_assayer_status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(ForeignKey("disputes.id"), index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    assayer_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(12), default="ACTIVE", index=True)  # ACTIVE | REVOKED
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    revoke_reason: Mapped[str] = mapped_column(String(300), default="")

class DisputeResolution(Base):
    """A *proposal* to close a dispute. It only takes effect when the other party approves."""
    __tablename__ = "dispute_resolutions"
    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(ForeignKey("disputes.id"), index=True)
    proposed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str] = mapped_column(String(20))  # AGREED_VALUE | ORIGINAL_STANDS
    agreed_value: Mapped[str | None] = mapped_column(String(300), nullable=True)
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(12), default="PROPOSED")  # PROPOSED|APPROVED|REJECTED
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resulting_version_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class SettlementHold(Base):
    __tablename__ = "settlement_holds"
    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(ForeignKey("disputes.id"), index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    held_g: Mapped[Decimal] = mapped_column(DecimalString)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class Settlement(Base):
    __tablename__ = "settlements"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    state: Mapped[str] = mapped_column(String(12), default="DRAFT")  # DRAFT|APPROVED|REJECTED
    partial: Mapped[bool] = mapped_column(Boolean, default=False)
    draft_json: Mapped[str] = mapped_column(Text)
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class SettlementApproval(Base):
    __tablename__ = "settlement_approvals"
    __table_args__ = (UniqueConstraint("settlement_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    settlement_id: Mapped[int] = mapped_column(ForeignKey("settlements.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(10))  # APPROVE | REJECT
    accept_partial: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[str] = mapped_column(Text)  # canonical JSON
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))

class SyncRecord(Base):
    __tablename__ = "sync_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(30))
    result_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(500))
    dedupe_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

# ---- Immutability guard ------------------------------------------------------------------
IMMUTABLE = (
    TransactionVersion,
    Confirmation,
    DisputeNote,
    EvidenceFile,
    SettlementApproval,
    AuditEvent,
)

def _refuse(mapper, connection, target):
    raise RuntimeError(f"{type(target).__name__} rows are immutable: add a new row instead")

for _model in IMMUTABLE:
    event.listen(_model, "before_update", _refuse)
    event.listen(_model, "before_delete", _refuse)
