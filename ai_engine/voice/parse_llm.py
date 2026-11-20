"""Optional LLM structured extraction for complex/messy spoken sentences.
Strictly validates against Pydantic schema and falls back to deterministic rule parser.
"""

from datetime import date
from pydantic import BaseModel
from ..llm import LLMClient
from .parse_rules import parse_entry as rule_parse

class LLMVoiceExtraction(BaseModel):
    karigar: str | None = None
    weight_g: str | None = None
    karat: int | None = None
    order_ref: str | None = None
    due_date: str | None = None
    kind: str = "issue"

def parse_with_llm_fallback(
    text: str,
    llm: LLMClient | None = None,
    known_karigars: tuple[str, ...] = (),
    today: date | None = None
) -> dict:
    """Uses LLM extraction if available, then reconciles/falls back to rule parsing."""
    today = today or date.today()
    if llm and llm.available:
        prompt = (
            f"You are extracting structured gold transaction details from spoken text.\n"
            f"Text: '{text}'\n"
            f"Known karigars: {list(known_karigars)}\n"
            f"Today's date: {today.isoformat()}\n"
            f"Extract: karigar name, weight_g, karat (integer), order_ref, due_date (YYYY-MM-DD), kind ('issue' or 'return')."
        )
        system = "Return valid JSON conforming to the requested schema. If a field is unknown, use null."
        res = llm.complete_json(system, prompt, LLMVoiceExtraction)
        if res and res.weight_g and res.karat:
            # Run rule parser to populate standard readback, questions, and confirmation fields
            parsed = rule_parse(text, known_karigars=known_karigars, today=today)
            if not parsed["fields"].get("karigar") and res.karigar:
                parsed["fields"]["karigar"] = res.karigar
            if not parsed["fields"].get("order_ref") and res.order_ref:
                parsed["fields"]["order_ref"] = res.order_ref
            return parsed

    # Default fallback
    return rule_parse(text, known_karigars=known_karigars, today=today)
