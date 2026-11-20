"""Tests for Voice Khata rule-based parser and readback."""

from datetime import date
from ai_engine.voice.parse_rules import parse_entry, normalise
from ai_engine.voice.readback import readback_text

def test_mandatory_proposal_sentence():
    """Mandatory example from handbook:
    'Ramesh ko 50 gram, 22 carat, haar ke liye, Friday tak.'
    """
    fixed_today = date(2026, 11, 10)  # Tuesday
    known = ["Ramesh", "Suresh"]
    text = "Ramesh ko 50 gram, 22 carat, haar ke liye, Friday tak."

    res = parse_entry(text, known_karigars=known, today=fixed_today)

    assert res["kind"] == "issue"
    assert res["fields"]["karigar"] == "Ramesh"
    assert res["fields"]["weight_g"] == "50"
    assert res["fields"]["karat"] == 22
    assert res["fields"]["order_ref"] == "haar"
    assert res["fields"]["due_date"] == "2026-11-13"  # coming Friday
    assert res["missing"] == []
    assert res["questions"] == []
    assert "Ramesh" in res["readback"]
    assert "50.00" in res["readback"]
    assert "22" in res["readback"]

def test_english_sentence():
    fixed_today = date(2026, 11, 10)
    text = "Issue 49.85 grams of 22 karat gold to Suresh for necklace due tomorrow"
    res = parse_entry(text, known_karigars=["Suresh"], today=fixed_today)

    assert res["kind"] == "issue"
    assert res["fields"]["karigar"] == "Suresh"
    assert res["fields"]["weight_g"] == "49.85"
    assert res["fields"]["karat"] == 22
    assert res["fields"]["due_date"] == "2026-11-11"
    assert res["missing"] == []

def test_spoken_number_words():
    fixed_today = date(2026, 11, 10)
    text = "Ramesh ko fifty grams, twenty two carat, for ring"
    res = parse_entry(text, known_karigars=["Ramesh"], today=fixed_today)
    assert res["fields"]["weight_g"] == "50"
    assert res["fields"]["karat"] == 22

def test_missing_fields_asks_questions():
    # Only weight provided
    res = parse_entry("50 gram", known_karigars=["Ramesh"])
    assert "karigar" in res["missing"]
    assert "karat" in res["missing"]
    assert len(res["questions"]) >= 2
    assert res["readback"] is None  # Never generate readback if fields are missing

def test_unknown_karigar_asks():
    res = parse_entry("Mahesh ko 50 gram 22 carat", known_karigars=["Ramesh", "Suresh"])
    assert "karigar" in res["missing"]
    assert any("Which karigar" in q for q in res["questions"])

def test_ambiguous_kal_asks():
    res = parse_entry("Ramesh ko 50 gram 22 carat kal tak", known_karigars=["Ramesh"])
    assert any("kal" in q for q in res["questions"])

def test_readback_hindi():
    draft = {
        "kind": "issue",
        "fields": {
            "karigar": "Ramesh",
            "weight_g": "50.00",
            "karat": 22,
            "order_ref": "haar",
            "due_date": "2026-11-13",
        },
    }
    hi_text = readback_text(draft, lang="hi")
    assert "Ramesh" in hi_text
    assert "50.00 ग्राम" in hi_text
    assert "22 कैरेट" in hi_text
    assert "क्या यह सही है?" in hi_text

def test_readback_kannada():
    draft = {
        "kind": "issue",
        "fields": {
            "karigar": "Ramesh",
            "weight_g": "50.00",
            "karat": 22,
            "order_ref": "haar",
            "due_date": "2026-11-13",
        },
    }
    kn_text = readback_text(draft, lang="kn")
    assert "Ramesh" in kn_text
    assert "50.00 ಗ್ರಾಂ" in kn_text
    assert "22 ಕ್ಯಾರಟ್" in kn_text
    assert "ಇದು ಸರಿಯೇ?" in kn_text

def test_kannada_spoken_number_words():
    # "Ramesh ge aivatthu gram, ippatteradu carat" -> 50g, 22K
    res = parse_entry("Ramesh ge aivatthu gram, ippatteradu carat, haar gaagi", known_karigars=["Ramesh"])
    assert res["fields"]["karigar"] == "Ramesh"
    assert res["fields"]["weight_g"] == "50"
    assert res["fields"]["karat"] == 22
    assert res["fields"]["order_ref"] == "haar"

def test_devanagari_numerals_normalisation():
    # ५० = 50, २२ = 22
    res = parse_entry("Ramesh ko ५० gram २२ carat", known_karigars=["Ramesh"])
    assert res["fields"]["weight_g"] == "50"
    assert res["fields"]["karat"] == 22

def test_evaluation_benchmarks():
    from ai_engine.evaluation.voice_eval import run_voice_eval
    from ai_engine.evaluation.ocr_eval import run_ocr_eval

    v_eval = run_voice_eval()
    assert v_eval["extraction_accuracy"] >= 0.8
    assert v_eval["missing_field_detection_rate"] >= 0.9

    ocr_eval = run_ocr_eval()
    assert ocr_eval["exact_match_accuracy"] == 1.0

def test_conflicting_weights_ambiguity():
    """When multiple distinct weights are heard in speech, parser must ask a clarification question."""
    res = parse_entry("Ramesh ko 50 gram aur 48 gram 22 karat diya", known_karigars=["Ramesh"])
    assert any("Multiple conflicting weights" in q for q in res["questions"])
    assert "weight_g" not in res["fields"]

def test_karigar_name_collision_ambiguity():
    """When a first name matches multiple karigars, parser must ask for clarification instead of guessing."""
    known = ["Suresh Rao", "Suresh Kumar"]
    res = parse_entry("Suresh ko 50 gram 22 karat diya", known_karigars=known)
    assert any("Multiple karigars match" in q for q in res["questions"])
    assert "karigar" not in res["fields"]

def test_vernacular_fractions_and_articles():
    """Fractions like 'aadha gram' (0.5g) and articles like 'kangan' or 'necklace' must be recognized."""
    res_hi = parse_entry("Ramesh ko aadha gram 22 karat kangan ke liye diya", known_karigars=["Ramesh"])
    assert res_hi["fields"]["weight_g"] == "0.5"
    assert res_hi["fields"]["order_ref"] == "kangan"

    res_en = parse_entry("Issue half gram 22k to Ramesh for necklace", known_karigars=["Ramesh"])
    assert res_en["fields"]["weight_g"] == "0.5"
    assert res_en["fields"]["order_ref"] == "necklace"

def test_relative_dates():
    """Dates like parso / naadiddu (day after tomorrow) and aaj / ivattu (today) resolve correctly."""
    today = date(2026, 11, 10)
    res_parso = parse_entry("Ramesh ko 50g 22k parso tak dena", known_karigars=["Ramesh"], today=today)
    assert res_parso["fields"]["due_date"] == "2026-11-12"

    res_aaj = parse_entry("Ramesh ko 50g 22k aaj dena", known_karigars=["Ramesh"], today=today)
    assert res_aaj["fields"]["due_date"] == "2026-11-10"

def test_parse_llm_fallback_without_keys():
    """When LLM is unavailable or lacks API keys, parse_with_llm_fallback works deterministically."""
    from ai_engine.voice.parse_llm import parse_with_llm_fallback
    res = parse_with_llm_fallback(
        "Issue 50.00 grams of 22 karat gold to Ramesh for necklace",
        llm=None,
        known_karigars=("Ramesh",),
        today=date(2026, 11, 10),
    )
    assert res["fields"]["weight_g"] == "50.00"
    assert res["fields"]["karat"] == 22
    assert res["fields"]["karigar"] == "Ramesh"
    assert res["fields"]["order_ref"] == "necklace"


