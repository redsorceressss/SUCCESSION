"""Text for the read-back step (and for the karigar's confirmation).
Hindi uses Devanagari so a Hindi text-to-speech voice reads it properly.
Kannada uses native script / phonetic templates for local speech synthesis.
"""

from datetime import date
from decimal import Decimal

def _g(x) -> str:
    s = format(Decimal(str(x)).normalize(), "f")
    return s + ".00" if "." not in s else s.split(".")[0] + "." + s.split(".")[1].ljust(2, "0")

def readback_text(draft: dict, lang: str = "en") -> str:
    f = draft["fields"]
    due = ""
    if f.get("due_date"):
        d = date.fromisoformat(f["due_date"])
        if lang == "en":
            due = f", due {d.strftime('%A %d %b %Y')}"
        elif lang == "hi":
            due = f", {d.strftime('%d-%m-%Y')} तक"
        elif lang == "kn":
            due = f", {d.strftime('%d-%m-%Y')} ರೊಳಗೆ"

    order = ""
    if f.get("order_ref"):
        if lang == "en":
            order = f" for {f['order_ref']}"
        elif lang == "hi":
            order = f" {f['order_ref']} के लिए"
        elif lang == "kn":
            order = f" {f['order_ref']} ಗಾಗಿ"

    verb = "Return" if draft["kind"] == "return" else "Issue"

    if lang == "hi":
        v = "वापस लिया जाएगा" if draft["kind"] == "return" else "दिया जाएगा"
        return f"{f['karigar']} को {_g(f['weight_g'])} ग्राम, {f['karat']} कैरेट सोना{order}{due} {v}। क्या यह सही है?"

    if lang == "kn":
        v = "ಹಿಂಪಡೆಯಲಾಗುವುದು" if draft["kind"] == "return" else "ನೀಡಲಾಗುವುದು"
        return f"{f['karigar']} ಅವರಿಗೆ {_g(f['weight_g'])} ಗ್ರಾಂ, {f['karat']} ಕ್ಯಾರಟ್ ಚಿನ್ನ{order}{due} {v}। ಇದು ಸರಿಯೇ?"

    return f"{verb} {_g(f['weight_g'])} g of {f['karat']} karat gold to {f['karigar']}{order}{due}. Is this correct?"
