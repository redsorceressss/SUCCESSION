"""Evaluation suite for Voice Khata extraction accuracy across English, Hindi, Hinglish, and Kannada."""

from datetime import date
from ..voice.parse_rules import parse_entry

BENCHMARK_SAMPLES = [
    # 1. Hindi standard entry
    {
        "id": "hi_01",
        "language": "Hindi",
        "text": "Ramesh ko 50 gram, 22 carat, haar ke liye, Friday tak.",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Ramesh", "weight_g": "50", "karat": 22, "order_ref": "haar"},
    },
    # 2. English standard entry
    {
        "id": "en_01",
        "language": "English",
        "text": "Issue 100 grams 24 carat to Suresh for ring due tomorrow",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Suresh", "weight_g": "100", "karat": 24, "order_ref": "ring"},
    },
    # 3. Hindi/Hinglish standard entry
    {
        "id": "hi_02",
        "language": "Hinglish",
        "text": "Suresh ko 25 gram, 18 kt, chain ke liye",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Suresh", "weight_g": "25", "karat": 18, "order_ref": "chain"},
    },
    # 4. Kannada standard entry
    {
        "id": "kn_01",
        "language": "Kannada",
        "text": "Ramesh ge aivatthu gram, ippatteradu carat, haar gaagi",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Ramesh", "weight_g": "50", "karat": 22, "order_ref": "haar"},
    },
    # 5. Hinglish spoken number words with decimal
    {
        "id": "hi_03",
        "language": "Hinglish",
        "text": "Ramesh ko pachas point aath paanch gram baais carat diya",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Ramesh", "weight_g": "50.85", "karat": 22},
    },
    # 6. Devanagari numerals
    {
        "id": "hi_04",
        "language": "Hindi",
        "text": "Ramesh ko ५० gram २२ carat diya",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Ramesh", "weight_g": "50", "karat": 22},
    },
    # 7. Vernacular fractions
    {
        "id": "hi_05",
        "language": "Hindi",
        "text": "Ramesh ko aadha gram 22 karat kangan ke liye diya",
        "known": ["Ramesh", "Suresh"],
        "expected": {"karigar": "Ramesh", "weight_g": "0.5", "karat": 22, "order_ref": "kangan"},
    },
    # 8. Missing karigar -> must detect missing
    {
        "id": "neg_01",
        "language": "English",
        "text": "40 gram, 22 carat, bangles ke liye",
        "known": ["Ramesh"],
        "expected_missing": ["karigar"],
    },
    # 9. Missing weight -> must detect missing
    {
        "id": "neg_02",
        "language": "Hindi",
        "text": "Ramesh ko 22 carat sona diya",
        "known": ["Ramesh"],
        "expected_missing": ["weight_g"],
    },
    # 10. Ambiguous date 'kal' -> must ask clarification question
    {
        "id": "amb_01",
        "language": "Hindi",
        "text": "Ramesh ko 50 gram 22 carat kal dena",
        "known": ["Ramesh"],
        "expected_question_substr": "Did you mean tomorrow?",
    },
    # 11. Conflicting weights -> must ask clarification question
    {
        "id": "amb_02",
        "language": "Hindi",
        "text": "Ramesh ko 50 gram aur 48 gram 22 karat diya",
        "known": ["Ramesh"],
        "expected_question_substr": "Multiple conflicting weights heard",
    },
    # 12. Karigar name collision -> must ask clarification question
    {
        "id": "amb_03",
        "language": "English",
        "text": "Give 50 grams 22 karat to Suresh",
        "known": ["Suresh Rao", "Suresh Kumar"],
        "expected_question_substr": "Multiple karigars match 'Suresh'",
    },
]

def run_voice_eval(today: date | None = None) -> dict:
    today = today or date(2026, 11, 10)
    total = len(BENCHMARK_SAMPLES)
    correct_extractions = 0
    extraction_targets = 0
    correct_missing_flags = 0
    missing_targets = 0
    correct_ambiguity_flags = 0
    ambiguity_targets = 0

    for sample in BENCHMARK_SAMPLES:
        res = parse_entry(sample["text"], known_karigars=sample["known"], today=today)
        if "expected" in sample:
            extraction_targets += 1
            match = True
            for k, v in sample["expected"].items():
                if res["fields"].get(k) != v:
                    match = False
            if match:
                correct_extractions += 1

        if "expected_missing" in sample:
            missing_targets += 1
            if set(sample["expected_missing"]).issubset(set(res["missing"])):
                correct_missing_flags += 1

        if "expected_question_substr" in sample:
            ambiguity_targets += 1
            if any(sample["expected_question_substr"] in q for q in res["questions"]):
                correct_ambiguity_flags += 1

    return {
        "dataset_type": "multilingual_voice_benchmark",
        "total_samples": total,
        "extraction_samples": extraction_targets,
        "extraction_accuracy": round(correct_extractions / float(extraction_targets), 2),
        "missing_field_detection_rate": round(correct_missing_flags / float(missing_targets), 2),
        "ambiguity_clarification_rate": round(correct_ambiguity_flags / float(ambiguity_targets), 2),
        "languages_tested": ["English", "Hindi", "Hinglish", "Kannada"],
    }

if __name__ == "__main__":
    import pprint
    pprint.pprint(run_voice_eval())

