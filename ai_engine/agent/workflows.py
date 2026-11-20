"""Agent workflows. Pattern for every one: trigger -> retrieve -> check state -> decide what is
allowed -> draft/recommend -> ask a human -> record. Gold maths comes from the backend, never from a model.
"""

import re
from datetime import date
from ..llm import LLMClient
from .gateway import Gateway

BANNED = re.compile(
    r"\b(lying|liar|cheat\w*|fraud\w*|thief|theft|stole\w*|guilty|dishonest|at fault|blame\w*|"
    r"should be (paid|awarded|refunded)|is wrong|is right|is correct)\b",
    re.I,
)

def is_neutral(text: str) -> bool:
    """Guardrail for model-written summaries: no verdicts about who is right."""
    return not BANNED.search(text)

def deadline_check(gw: Gateway, today: date, warn_days: int = 3) -> int:
    sent = 0
    for o in gw.orders():
        if not o["due_date"] or o["has_return"]:
            continue
        days = (date.fromisoformat(o["due_date"]) - today).days
        if days > warn_days:
            continue
        when = "is overdue" if days < 0 else ("is due today" if days == 0 else f"is due in {days} day(s)")
        msg = f"Order #{o['order_id']} ({o['description']}) {when} (due {o['due_date']})."
        for uid in (o["karigar_id"], o["jeweller_id"]):
            if gw.notify(uid, "deadline", msg, f"due-{o['order_id']}-{today.isoformat()}")["created"]:
                sent += 1
    return sent

def plain_summary(draft: dict) -> str:
    rec = draft["reconciliation"]
    lines = [f"Order #{draft['order_id']} reconciliation (fine gold, grams):", *rec["lines"]]
    if rec["status"] == "REVIEW":
        lines.append(
            "The unexplained gap is larger than the expected variance. This is a question for both "
            "parties to check together, with the scale photos. It is not a finding about anyone."
        )
    if draft["has_holds"]:
        lines.append(f"{draft['held_g_total']} g is in dispute and held out of this settlement.")
    return "\n".join(lines)

def reconcile_ready(gw: Gateway) -> int:
    """If every entry is settled and a return exists, prepare a settlement DRAFT for humans to approve."""
    made = 0
    for o in gw.orders():
        if not o["has_return"] or o["pending_entries"] or o["disputed_entries"]:
            continue
        if any(s["state"] == "DRAFT" for s in gw.settlements(o["order_id"])):
            continue  # one open draft at a time
        st = gw.draft_settlement(o["order_id"])
        gw.log_task("reconciliation_draft", o["order_id"], plain_summary(st["draft"]))
        made += 1
    return made

def dispute_reminders(gw: Gateway, today: date, min_age_days: int = 2) -> int:
    sent = 0
    for d in gw.disputes():
        if d["age_days"] < min_age_days:
            continue
        msg = (
            f"Dispute #{d['dispute_id']} has been open for {d['age_days']} days. "
            "Please add notes or evidence, or consider reweighing."
        )
        for uid in (d["karigar_id"], d["jeweller_id"]):
            if gw.notify(uid, "dispute_reminder", msg, f"dispute-{d['dispute_id']}-{today.isoformat()}")["created"]:
                sent += 1
    return sent

def dispute_facts(d: dict) -> str:
    done = sum(r["status"] == "DONE" for r in d["reweigh_requests"])
    return (
        f"Dispute #{d['id']} on entry #{d['transaction_id']} (field: {d['field']}). Recorded value: "
        f"{d['original_value']}. Value reported by user #{d['raised_by']}: {d['claimed_value']}. "
        f"Notes: {len(d['notes'])}. Evidence files: {len(d['evidence'])}. Reweighing requests: "
        f"{len(d['reweigh_requests'])} ({done} done). Held from settlement: {d['held_g']} g. Status: "
        f"{d['state']}. This summary lists facts only; it takes no side between the two reports."
    )

def summarise_dispute(gw: Gateway, dispute_id: int, llm: LLMClient | None = None) -> str:
    """Neutral summary for human review. The template is the default; an LLM may rephrase it, and its
    output is thrown away if it contains any verdict language.
    """
    facts = dispute_facts(gw.dispute(dispute_id))
    if llm and llm.available:
        text = llm.complete_text(
            "Rewrite these dispute facts as a short, neutral, plain-language summary. "
            "Do not add facts. Do not say who is right or wrong.",
            facts,
        )
        if text and is_neutral(text):
            return text
    return facts

def run_once(gw: Gateway, today: date | None = None) -> dict:
    today = today or date.today()
    return {
        "deadline_reminders": deadline_check(gw, today),
        "settlement_drafts": reconcile_ready(gw),
        "dispute_reminders": dispute_reminders(gw, today),
    }
