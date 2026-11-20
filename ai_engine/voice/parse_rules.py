"""Rule-based parser: spoken (or typed) text -> a DRAFT gold entry.
Deterministic, free, instant, works offline, fully unit-tested.
Golden rule: if a field is missing or unsure, ASK. Never guess a weight, karat, name or date.
"""

import difflib
import re
import unicodedata
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from .readback import readback_text

EN_UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
EN_TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90,
}
HI_WORDS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5,
    "chhe": 6, "chhah": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "gyarah": 11, "barah": 12, "terah": 13, "chaudah": 14, "pandrah": 15, "solah": 16,
    "satrah": 17, "atharah": 18, "unnis": 19, "bees": 20, "ikkis": 21, "baais": 22,
    "teis": 23, "chaubis": 24, "pachis": 25, "tees": 30, "chalis": 40, "pachas": 50,
    "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90,
}
KN_WORDS = {
    "ondu": 1, "ondhu": 1, "eradu": 2, "mooru": 3, "naalku": 4, "aidu": 5, "aaru": 6,
    "elu": 7, "yelu": 7, "entu": 8, "ombattu": 9, "ombathu": 9, "hatthu": 10, "hathu": 10,
    "hannondu": 11, "hanneradu": 12, "hadimooru": 13, "hadinaalku": 14, "hadinaidu": 15,
    "hadinaaru": 16, "hadinelu": 17, "hadinentu": 18, "hattombattu": 19,
    "ippatthu": 20, "ippathu": 20, "ippattondu": 21, "ippatteradu": 22, "ippatmooru": 23,
    "ippatnaalku": 24, "ippattaidu": 25, "muvvatthu": 30, "nalvatthu": 40,
    "aivatthu": 50, "ayvatthu": 50, "aravatthu": 60, "eppatthu": 70, "embatthu": 80,
    "tombatthu": 90,
}

HUNDRED = {"hundred", "sau", "nooru"}
POINT = {"point", "dashamlav", "bindu"}
ALL_NUM = set(EN_UNITS) | set(EN_TENS) | set(HI_WORDS) | set(KN_WORDS) | HUNDRED

WEEKDAYS = {
    "monday": 0, "mon": 0, "somvar": 0, "somavara": 0,
    "tuesday": 1, "tue": 1, "mangalvar": 1, "mangalavara": 1,
    "wednesday": 2, "wed": 2, "budhvar": 2, "budhavara": 2,
    "thursday": 3, "thu": 3, "guruvar": 3, "veervar": 3, "guruvara": 3,
    "friday": 4, "fri": 4, "shukravar": 4, "shukravara": 4,
    "saturday": 5, "sat": 5, "shanivar": 5, "shanivara": 5,
    "sunday": 6, "sun": 6, "ravivar": 6, "itwar": 6, "bhanuvara": 6,
}
RETURN_WORDS = {"return", "returned", "wapas", "vapas", "lauta", "lautaya", "received", "thogondidini", "hinde", "vapassu"}
TYPICAL_KARATS = {14, 18, 20, 22, 24}

def normalise(text: str) -> str:
    """Lower-case; turn Devanagari/Kannada/Arabic digits into ASCII digits; drop punctuation."""
    out = []
    for ch in unicodedata.normalize("NFKC", text).lower():
        if unicodedata.category(ch) == "Nd":
            out.append(str(unicodedata.digit(ch)))
        elif unicodedata.category(ch)[0] in "LMN" or ch == "." or ch.isspace():
            out.append(ch)
        else:
            out.append(" ")
    return re.sub(r"\s+", " ", "".join(out)).strip()

def _words_to_digits(tokens: list[str]) -> tuple[list[str], bool]:
    """Replace runs of number words by digits: ['forty','nine','point','eight','five'] -> ['49.85']."""
    out, i, converted = [], 0, False
    while i < len(tokens):
        t = tokens[i]
        if t in ALL_NUM:
            value, cur = 0, 0
            while i < len(tokens) and tokens[i] in ALL_NUM:
                w = tokens[i]
                if w in HUNDRED:
                    cur = (cur or 1) * 100
                else:
                    cur += EN_UNITS.get(w) or EN_TENS.get(w) or HI_WORDS.get(w) or KN_WORDS.get(w) or 0
                i += 1
            value += cur
            text = str(value)
            if i < len(tokens) and tokens[i] in POINT:
                j, digits = i + 1, ""
                while j < len(tokens) and (tokens[j] in EN_UNITS or tokens[j] in HI_WORDS or tokens[j] in KN_WORDS) and (EN_UNITS.get(tokens[j], 99) < 10 or HI_WORDS.get(tokens[j], 99) < 10 or KN_WORDS.get(tokens[j], 99) < 10):
                    val_sub = EN_UNITS.get(tokens[j]) or HI_WORDS.get(tokens[j]) or KN_WORDS.get(tokens[j])
                    digits += str(val_sub)
                    j += 1
                if digits:
                    text, i = f"{value}.{digits}", j
            out.append(text)
            converted = True
        else:
            out.append(t)
            i += 1
    return out, converted

JEWELLERY_ARTICLES = {
    "necklace", "chain", "ring", "bangle", "bangles", "bracelet", "earring", "earrings",
    "anklet", "pendant", "kangan", "chudi", "churi", "anguthi", "haar", "jhumka", "payal",
    "bala", "nath", "mangalsutra", "kada", "kadaga", "ungura", "sara", "ole", "jumki",
    "kappe", "gejje", "haara", "kaalungura"
}

FRACTIONAL_WORDS = {
    "aadha": Decimal("0.5"),
    "adha": Decimal("0.5"),
    "paav": Decimal("0.25"),
    "dedh": Decimal("1.5"),
    "dhai": Decimal("2.5"),
    "ardha": Decimal("0.5"),
    "kaalu": Decimal("0.25"),
    "mukkaalu": Decimal("0.75"),
    "half": Decimal("0.5"),
    "quarter": Decimal("0.25"),
}

def _match_name(heard: str, known: list[str]) -> tuple[str | None, float, list[str]]:
    """Matches heard name against known karigars, flagging ambiguous multiple matches."""
    if not known:
        return heard.title(), 0.5, []

    # Exact full name match
    for k in known:
        if heard.lower() == k.lower():
            return k, 1.0, []

    # First name match
    first_matches = [k for k in known if k.lower().split()[0] == heard.lower()]
    if len(first_matches) == 1:
        return first_matches[0], 0.95, []
    elif len(first_matches) > 1:
        # Ambiguous collision: multiple karigars share this first name
        return None, 0.0, first_matches

    # Fuzzy match
    lowered_map = {k.lower(): k for k in known}
    close = difflib.get_close_matches(heard.lower(), list(lowered_map.keys()), n=2, cutoff=0.75)
    if len(close) == 1:
        matched = lowered_map[close[0]]
        ratio = round(difflib.SequenceMatcher(None, heard.lower(), close[0]).ratio(), 2)
        return matched, ratio, []
    elif len(close) > 1:
        return None, 0.0, [lowered_map[c] for c in close]

    return None, 0.0, []


def _next_weekday(today: date, wd: int) -> date:
    return today + timedelta(days=(wd - today.weekday()) % 7 or 7)

def parse_entry(text: str, known_karigars=(), today: date | None = None) -> dict:
    today = today or date.today()
    known = list(known_karigars)
    norm = normalise(text)
    tokens, converted = _words_to_digits(norm.split())
    s = " ".join(tokens)
    fields: dict = {}
    conf: dict = {}
    confirm: list[str] = []
    questions: list[str] = []

    kind = "return" if RETURN_WORDS & set(tokens) else "issue"
    if kind == "issue" and not ({"issue", "diya", "gave", "give", "de", "diye", "kodi", "kottu"} & set(tokens)):
        confirm.append("kind")

    weight_matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:grams?|gms?|gm|g|gram|ಗ್ರಾಂ|ಗ್ರಾಮ್|ग्राम)(?![a-z])", s)
    if len(set(weight_matches)) > 1:
        # Multiple conflicting weights heard
        questions.append(f"Multiple conflicting weights heard ({', '.join(weight_matches)} g). Which exact weight should be recorded?")
    elif len(weight_matches) >= 1:
        try:
            fields["weight_g"] = str(Decimal(weight_matches[0]))
            conf["weight_g"] = 0.8 if converted else 0.95
        except InvalidOperation:
            pass
    else:
        # Check fractional vernacular words (e.g. "aadha gram", "half gram")
        for f_word, f_val in FRACTIONAL_WORDS.items():
            if f_word in tokens:
                idx_f = tokens.index(f_word)
                if idx_f + 1 < len(tokens) and tokens[idx_f + 1] in {"gram", "grams", "g", "gm", "gms", "ಗ್ರಾಂ", "ಗ್ರಾಮ್", "ग्राम"}:
                    fields["weight_g"] = str(f_val)
                    conf["weight_g"] = 0.85
                    break

    m = re.search(r"(\d{1,2})\s*(?:carats?|karats?|kt|k|ಕ್ಯಾರಟ್|ಕ್ಯಾರೆಟ್|कैरेट)(?![a-z])", s)
    if m:
        fields["karat"] = int(m.group(1))
        conf["karat"] = 0.95
        if fields["karat"] not in TYPICAL_KARATS or not 1 <= fields["karat"] <= 24:
            confirm.append("karat")

    heard = None
    for i, t in enumerate(tokens):
        if t in ("ko", "ge", "ige", "geye") and i > 0 and not tokens[i - 1].replace(".", "").isdigit():
            heard = tokens[i - 1]
            break
        if t == "to" and i + 1 < len(tokens) and tokens[i + 1] not in ALL_NUM and not tokens[i + 1].replace(".", "").isdigit():
            heard = tokens[i + 1]
            break

    if heard and heard not in ALL_NUM:
        name, score, collisions = _match_name(heard, known)
        if collisions:
            questions.append(f"Multiple karigars match '{heard.title()}': {', '.join(collisions)}. Which karigar do you mean?")
        elif name:
            fields["karigar"], conf["karigar"] = name, score
            if score < 0.9:
                confirm.append("karigar")
        else:
            questions.append(f"I heard '{heard.title()}'. Which karigar do you mean? ({', '.join(known)})")

    order = None
    for i, t in enumerate(tokens):
        if t == "ke" and i > 0 and i + 1 < len(tokens) and tokens[i + 1] in ("liye", "liay"):
            order = tokens[i - 1]
            break
        if t in ("gaagi", "kosam") and i > 0:
            order = tokens[i - 1]
            break
        if t == "for":
            rest = [x for x in tokens[i + 1:] if x not in ("a", "an", "the")]
            order = rest[0] if rest else None
            break

    if order and not order.replace(".", "").isdigit() and order not in {"karat", "carat", "gram", "grams", "k"}:
        fields["order_ref"], conf["order_ref"] = order, 0.7
        confirm.append("order_ref")
    elif "order_ref" not in fields:
        for art in JEWELLERY_ARTICLES:
            if art in tokens:
                fields["order_ref"] = art
                conf["order_ref"] = 0.8
                break

    day = next((t for t in tokens if t in WEEKDAYS), None)
    if day:
        d = _next_weekday(today, WEEKDAYS[day])
        fields["due_date"], fields["due_text"], conf["due_date"] = d.isoformat(), day, 0.7
    elif "tomorrow" in tokens or "naale" in tokens:
        fields["due_date"], fields["due_text"], conf["due_date"] = (today + timedelta(days=1)).isoformat(), "tomorrow", 0.9
    elif "parso" in tokens or "naadiddu" in tokens:
        fields["due_date"], fields["due_text"], conf["due_date"] = (today + timedelta(days=2)).isoformat(), "day after tomorrow", 0.9
    elif "aaj" in tokens or "ivattu" in tokens or "today" in tokens:
        fields["due_date"], fields["due_text"], conf["due_date"] = today.isoformat(), "today", 0.9
    elif "kal" in tokens:
        questions.append("Did you mean tomorrow? ('kal' can also mean yesterday.) Please say the day or date.")

    if "due_date" in fields:
        confirm.append("due_date")

    missing = [f for f in ("karigar", "weight_g", "karat") if f not in fields]
    labels = {
        "karigar": "Which karigar is this for?",
        "weight_g": "How many grams?",
        "karat": "Which karat (e.g. 22)?",
    }
    questions += [labels[f] for f in missing if not any(labels[f] == q for q in questions)]

    if "weight_g" not in fields:
        bare_candidates = [
            t for t in tokens
            if t.replace(".", "").isdigit()
            and (fields.get("karat") is None or int(float(t)) != fields.get("karat"))
        ]
        if bare_candidates:
            questions.append(f"I heard '{bare_candidates[0]}'. Did you mean {bare_candidates[0]} grams? Please specify the unit (grams).")


    if "weight_g" in fields and Decimal(fields["weight_g"]) > 5000:
        confirm.append("weight_g")

    result = {
        "kind": kind,
        "fields": fields,
        "missing": missing,
        "questions": questions,
        "needs_confirmation": sorted(set(confirm)),
        "confidence": conf,
        "source_text": text,
        "note": "DRAFT only. Nothing is saved until the user reviews and confirms.",
    }
    result["readback"] = None if missing else readback_text(result)
    return result
