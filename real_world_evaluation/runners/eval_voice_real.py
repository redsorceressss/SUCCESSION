"""Real-World Voice & Hinglish NLP Evaluation Runner.
Evaluates the voice transaction parser against 18 real-world Hinglish workshop dialogues.
Evaluates structured field extraction, vernacular quantities, and ambiguity/clarification triggers.
Documents speech ASR status for Google FLEURS.
Zero interaction with production database (swarn.db).
"""

import json
import time
from datetime import date
from pathlib import Path
from decimal import Decimal

from ai_engine.voice.parse_rules import parse_entry

BASE_DIR = Path(__file__).resolve().parent.parent
HINGLISH_PATH = BASE_DIR / "datasets" / "voice" / "hinglish_text_cases" / "hinglish_cases.json"
RESULTS_PATH = BASE_DIR / "results" / "voice_evaluation_results.json"

def run_voice_evaluation() -> dict:
    print(f"Loading Hinglish test cases from: {HINGLISH_PATH}")
    assert HINGLISH_PATH.exists(), f"Hinglish cases file not found: {HINGLISH_PATH}"

    with open(HINGLISH_PATH, "r", encoding="utf-8") as f:
        cases = json.load(f)

    total_cases = len(cases)
    fixed_date = date(2026, 11, 10)

    correct_field_extractions = 0
    correct_kind_extractions = 0
    correct_missing_detections = 0
    total_missing_expectations = 0
    correct_clarification_triggers = 0
    total_clarification_expectations = 0

    detailed_results = []

    for item in cases:
        cid = item["id"]
        text = item["text"]
        known = item.get("known_karigars", [])
        exp_kind = item.get("expected_kind")
        exp_fields = item.get("expected_fields", {})
        exp_missing = item.get("expected_missing", [])
        should_clarify = item.get("should_ask_clarification", False)
        clarify_substr = item.get("clarification_substr")

        parsed = parse_entry(text, known_karigars=known, today=fixed_date)

        # 1. Kind check
        kind_ok = (parsed.get("kind") == exp_kind)
        if kind_ok:
            correct_kind_extractions += 1

        # 2. Field match
        fields = parsed.get("fields", {})
        fields_ok = True
        for k, v in exp_fields.items():
            if str(fields.get(k)) != str(v):
                fields_ok = False
                break
        if fields_ok:
            correct_field_extractions += 1

        # 3. Missing detection
        missing_ok = True
        if exp_missing:
            total_missing_expectations += 1
            missing_ok = set(exp_missing).issubset(set(parsed.get("missing", [])))
            if missing_ok:
                correct_missing_detections += 1

        # 4. Clarification question check
        clarify_ok = True
        if should_clarify:
            total_clarification_expectations += 1
            questions = parsed.get("questions", [])
            if not questions:
                clarify_ok = False
            elif clarify_substr:
                clarify_ok = any(clarify_substr.lower() in q.lower() for q in questions)
            if clarify_ok:
                correct_clarification_triggers += 1

        case_passed = kind_ok and fields_ok and missing_ok and clarify_ok
        detailed_results.append({
            "id": cid,
            "text": text,
            "kind_match": kind_ok,
            "fields_match": fields_ok,
            "missing_match": missing_ok,
            "clarification_match": clarify_ok,
            "passed": case_passed,
            "parsed_fields": fields,
            "questions": parsed.get("questions", []),
        })

    field_acc = correct_field_extractions / float(total_cases)
    kind_acc = correct_kind_extractions / float(total_cases)
    missing_acc = correct_missing_detections / max(total_missing_expectations, 1)
    clarify_acc = correct_clarification_triggers / max(total_clarification_expectations, 1)

    results = {
        "benchmark": "Voice & Hinglish Real-World NLP Evaluation",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "subsystems_evaluated": [
            "Hinglish Workshop Transaction Text Parser",
            "Vernacular Fractional Weights & Numerals",
            "Ambiguity & Clarification Dialogue Engine"
        ],
        "total_test_cases": total_cases,
        "metrics": {
            "structured_field_extraction_accuracy": round(field_acc, 4),
            "transaction_kind_accuracy": round(kind_acc, 4),
            "missing_field_detection_rate": round(missing_acc, 4),
            "ambiguity_clarification_trigger_rate": round(clarify_acc, 4),
        },
        "speech_recognition_asr_status": {
            "dataset": "Google FLEURS (hi_in, kn_in)",
            "local_asr_engine": "faster_whisper",
            "asr_engine_status": "NOT_INSTALLED (CPU fallback active; offline parser tested deterministically)",
            "huggingface_streaming_investigation": "HuggingFace Datasets-Server /rows API returned 500; PyArrow HTTP Range requests timed out on CDN; selective streaming via 'datasets' requires 'soundfile' dependency. Full test split requires 864 MB (tar.gz) or 1,037 MB (parquet). Transfer on hold per master prompt instructions.",
            "recommendation": "Maintain deterministic text-based parser as primary offline pipeline. Audio evaluation can execute once soundfile/faster-whisper dependencies or local audio collection are approved."
        },
        "case_details": detailed_results
    }

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nVoice & Hinglish Evaluation Completed. Results saved to: {RESULTS_PATH}")
    print(f"Total Cases: {total_cases}")
    print(f"Field Extraction Accuracy: {field_acc*100:.1f}%")
    print(f"Transaction Kind Accuracy: {kind_acc*100:.1f}%")
    print(f"Missing Field Detection Rate: {missing_acc*100:.1f}%")
    print(f"Clarification Trigger Rate: {clarify_acc*100:.1f}%")
    return results

if __name__ == "__main__":
    run_voice_evaluation()
