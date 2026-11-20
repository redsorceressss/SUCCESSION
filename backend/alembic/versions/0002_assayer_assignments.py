"""Add explicit assayer assignment table for dispute verification workflow

Revision ID: 0002_assayer_assignments
Revises: 0001_initial
Create Date: 2026-11-12 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_assayer_assignments"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assayer_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dispute_id", sa.Integer(), sa.ForeignKey("disputes.id"), nullable=False),
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("assayer_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="ACTIVE"),
        sa.Column("note", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("revoke_reason", sa.String(length=300), nullable=False, server_default=""),
        sa.UniqueConstraint("dispute_id", "assayer_user_id", "status", name="uq_assayer_assignment_dispute_assayer_status"),
    )
    op.create_index("ix_assayer_assignments_dispute_id", "assayer_assignments", ["dispute_id"])
    op.create_index("ix_assayer_assignments_transaction_id", "assayer_assignments", ["transaction_id"])
    op.create_index("ix_assayer_assignments_order_id", "assayer_assignments", ["order_id"])
    op.create_index("ix_assayer_assignments_assayer_user_id", "assayer_assignments", ["assayer_user_id"])
    op.create_index("ix_assayer_assignments_status", "assayer_assignments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_assayer_assignments_status", table_name="assayer_assignments")
    op.drop_index("ix_assayer_assignments_assayer_user_id", table_name="assayer_assignments")
    op.drop_index("ix_assayer_assignments_order_id", table_name="assayer_assignments")
    op.drop_index("ix_assayer_assignments_transaction_id", table_name="assayer_assignments")
    op.drop_index("ix_assayer_assignments_dispute_id", table_name="assayer_assignments")
    op.drop_table("assayer_assignments")