# AI / ML Engine & Advisory Agent

## Overview
The `ai_engine/` package contains the AI and machine-learning services for the Jeweltech gold ledger.

### Architectural Invariants:
1. **Zero backend dependency:** `ai_engine` does not import any module from `backend/`. It can be run, tested, and evaluated in total isolation.
2. **Deterministic Fallbacks:** Every component features an offline rule-based or classic computer vision fallback.
3. **Strict Permission Boundary:** The Agent interacts with the system only via an authenticated HTTP gateway (`Gateway`), and possesses no capability to confirm, resolve, or approve transactions or settlements.

---

## Directory Structure
- `voice/`:
  - `parse_rules.py`: Deterministic parser for spoken / typed entries in English and Hindi-English (Hinglish).
  - `readback.py`: Generates read-back sentences in English and Hindi for verification before saving.
  - `parse_llm.py`: Optional OpenAI-compatible structured LLM extraction wrapper with schema validation.
  - `stt.py`: Optional faster-whisper speech-to-text integration with lazy CPU loading.
  - `validation.py`: Input checks for missing karigar, weight, or karat.
- `ocr/`:
  - `seven_segment.py`: Classic computer vision decoder for digital scale displays.
  - `read_display.py`: Image loading, preprocessing, and Decimal value extraction.
  - `compare.py`: Decimal-exact tolerance matching against entered weights (`MATCH`, `MISMATCH`, `UNREADABLE`).
  - `preprocess.py`: CLAHE contrast enhancement, resizing, and noise filtering.
- `agent/`:
  - `permissions.py`: Code-enforced whitelist (`ALLOWED`) and blacklist (`FORBIDDEN`).
  - `gateway.py`: HTTP client interface strictly limited to advisory endpoints.
  - `workflows.py`: Deadline tracking, dispute reminders, and settlement draft generation.
  - `memory.py`: Shop-scoped historical case memory.
  - `run_once.py`: Single-pass CLI runner.
  - `scheduler.py`: APScheduler 15-minute background worker.
- `rag/`:
  - Optional local retrieval engine for operational guidance and dispute protocols.
- `evaluation/`:
  - Evaluation benchmarks for voice parser and synthetic scale OCR images.
