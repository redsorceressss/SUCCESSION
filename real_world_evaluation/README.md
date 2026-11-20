# Real-World Evaluation Framework

This directory contains the independent, real-world evaluation infrastructure for SUCCESSION.

## Directory Structure
* `datasets/`: External and team-collected benchmark datasets.
  * `rag/`: BIS official hallmarking FAQs and jewellery invoice templates.
  * `ocr/`: Mendeley 7-segment digital displays and weighing scale photo templates.
  * `voice/`: Google FLEURS Hindi/Kannada pilots and Hinglish transaction test cases.
  * `agent/`: Holding directory for adversarial safety benchmarks.
* `runners/`: Isolated evaluation runners that execute benchmarks against existing AI modules without modifying production state or database.
* `results/`: Machine-readable evaluation outputs in JSON format.
* `real_world_report.md`: Consolidated evidence-based evaluation report and recommendations.

## Running the Benchmarks
Run each benchmark independently using Python from the repository root:

```powershell
# 1. RAG Evaluation (BIS Grounding, MRR, Precision@1, Abstention)
python -m real_world_evaluation.runners.eval_rag_real

# 2. OCR Evaluation (Mendeley 7-Segment Real Photos)
python -m real_world_evaluation.runners.eval_ocr_real

# 3. Voice & Hinglish NLP Evaluation (FLEURS Speech & Hinglish Parsing)
python -m real_world_evaluation.runners.eval_voice_real

# 4. Agent Gateway Permission & Safety Audit
python -m real_world_evaluation.runners.eval_agent_safety_real
```

## Isolation Principles
1. `swarn.db` is never read or written to by evaluation code.
2. Production code and regression tests (`tests/`) are strictly isolated and preserved.
3. No models are trained or fine-tuned on evaluation data.
