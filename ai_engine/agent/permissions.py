"""What the agent may and may not do. Two layers protect the ledger:
 1. this table (the agent's own code refuses forbidden actions), and
 2. the backend (the 'agent' role gets 403 on resolve / approve / confirm / edit endpoints).
Prompts are NOT a security layer. Never rely on telling the model 'please do not'.
"""

ALLOWED = {
    "read",
    "remind",
    "summarise",
    "draft_settlement",
    "suggest_reweigh",
    "translate",
    "log",
}

FORBIDDEN = {
    "resolve_dispute",
    "approve_settlement",
    "reject_settlement",
    "release_hold",
    "edit_value",
    "confirm_entry",
    "delete",
    "settle_payment",
    "decide_who_is_right",
}

def check(action: str) -> None:
    if action in FORBIDDEN or action not in ALLOWED:
        raise PermissionError(f"The agent is not allowed to perform '{action}'")
