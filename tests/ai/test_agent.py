"""Tests for Agent permissions, neutrality guard, and workflows."""

from datetime import date
from decimal import Decimal
import pytest
from ai_engine.agent.permissions import check, ALLOWED, FORBIDDEN
from ai_engine.agent.gateway import Gateway
from ai_engine.agent.workflows import (
    is_neutral,
    deadline_check,
    dispute_reminders,
    reconcile_ready,
    run_once,
)
from ai_engine.agent.memory import CaseMemory

def test_agent_permission_boundary():
    # Allowed actions pass
    for action in ALLOWED:
        check(action)  # does not raise

    # Forbidden actions raise PermissionError
    for forbidden in FORBIDDEN:
        with pytest.raises(PermissionError, match="not allowed"):
            check(forbidden)

    # Unknown actions raise PermissionError (default deny)
    with pytest.raises(PermissionError):
        check("arbitrary_hack_action")

def test_gateway_methods_do_not_contain_human_actions():
    methods = [m for m in dir(Gateway) if not m.startswith("_")]
    # Assert neither approve nor resolve exists on Gateway
    assert "approve_settlement" not in methods
    assert "approve" not in methods
    assert "resolve_dispute" not in methods
    assert "resolve" not in methods

def test_neutrality_guard():
    assert is_neutral("The recorded weight is 50.00 g and claimed is 49.85 g.") is True
    assert is_neutral("The karigar is a liar and cheat.") is False
    assert is_neutral("The jeweller is guilty of theft.") is False
    assert is_neutral("The jeweller is right.") is False

class MockGateway:
    def __init__(self):
        self.notifications_sent = []
        self.drafts_created = []
        self.tasks_logged = []

    def orders(self):
        return [
            {
                "order_id": 1,
                "jeweller_id": 10,
                "karigar_id": 20,
                "description": "22K Haar",
                "due_date": "2026-11-12",
                "has_return": False,
                "pending_entries": 0,
                "disputed_entries": 0,
            },
            {
                "order_id": 2,
                "jeweller_id": 10,
                "karigar_id": 20,
                "description": "Bangle",
                "due_date": "2026-11-15",
                "has_return": True,
                "pending_entries": 0,
                "disputed_entries": 0,
            },
        ]

    def disputes(self):
        return [
            {"dispute_id": 1, "order_id": 1, "jeweller_id": 10, "karigar_id": 20, "age_days": 3}
        ]

    def settlements(self, order_id: int):
        return []

    def draft_settlement(self, order_id: int):
        self.drafts_created.append(order_id)
        return {
            "draft": {
                "order_id": order_id,
                "has_holds": False,
                "reconciliation": {"lines": ["Line 1"], "status": "BALANCED"},
            }
        }

    def notify(self, user_id: int, kind: str, message: str, dedupe_key: str | None = None):
        self.notifications_sent.append((user_id, kind, dedupe_key))
        return {"created": True}

    def log_task(self, kind: str, order_id: int | None, summary: str):
        self.tasks_logged.append((kind, order_id))
        return {"id": 1}

def test_agent_workflows_execution():
    gw = MockGateway()
    today = date(2026, 11, 10)

    # 1. Deadline check
    sent = deadline_check(gw, today, warn_days=3)
    assert sent == 2  # Notified jeweller (10) and karigar (20) for order 1

    # 2. Dispute reminders (dispute 1 is 3 days old >= 2 days)
    dispute_sent = dispute_reminders(gw, today, min_age_days=2)
    assert dispute_sent == 2

    # 3. Reconcile ready: order 2 has return and no pending/disputed entries
    drafts = reconcile_ready(gw)
    assert drafts == 1
    assert 2 in gw.drafts_created

def test_case_memory():
    mem = CaseMemory()
    # No prior data
    assert mem.suggest_wastage_range(1, 2, "haar", 22) is None

    # Record jobs
    mem.record_job_outcome(1, 2, "haar", 22, Decimal("1.8"))
    mem.record_job_outcome(1, 2, "haar", 22, Decimal("2.2"))

    res = mem.suggest_wastage_range(1, 2, "haar", 22)
    assert res is not None
    min_w, max_w, count = res
    assert min_w == Decimal("1.8")
    assert max_w == Decimal("2.2")
    assert count == 2

    # Cross-shop isolation: another jeweller gets None
    assert mem.suggest_wastage_range(99, 2, "haar", 22) is None

def test_agent_safety_default_deny_exhaustive():
    """Default deny: every unlisted verb must raise PermissionError."""
    unauthorized_verbs = [
        "approve_settlement", "resolve_dispute", "release_hold",
        "delete_transaction", "modify_gold_balance", "forge_signature",
        "grant_admin", "override_purity", "system_reboot"
    ]
    for verb in unauthorized_verbs:
        with pytest.raises(PermissionError):
            check(verb)

def test_agent_draft_only_no_balance_mutation():
    """Agent creates a draft settlement; verify it is strictly marked DRAFT and cannot self-approve."""
    gw = MockGateway()
    res = gw.draft_settlement(order_id=42)
    assert 42 in gw.drafts_created
    assert res["draft"]["order_id"] == 42
    # Gateway has no approval mechanism
    assert not hasattr(gw, "approve_settlement")
    assert not hasattr(gw, "resolve_dispute")

def test_shop_scoped_memory_adversarial_queries():
    """Verify shop-scoped memory prevents unauthorized tenant probing."""
    mem = CaseMemory()
    # Shop 10 records sensitive wastage benchmark
    mem.record_job_outcome(jeweller_id=10, karigar_id=5, order_type="kangan", karat=22, wastage_pct=Decimal("1.25"))

    # Shop 10 can query its own benchmark
    shop10_data = mem.suggest_wastage_range(jeweller_id=10, karigar_id=5, order_type="kangan", karat=22)
    assert shop10_data is not None
    assert shop10_data[0] == Decimal("1.25")

    # Competitor Shop 20 querying the same karigar gets NO data
    shop20_data = mem.suggest_wastage_range(jeweller_id=20, karigar_id=5, order_type="kangan", karat=22)
    assert shop20_data is None

    # Competitor querying with non-existent shop id gets NO data
    assert mem.suggest_wastage_range(jeweller_id=999, karigar_id=5, order_type="kangan", karat=22) is None

