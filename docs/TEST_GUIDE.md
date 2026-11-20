# Test Guide & Quality Verification

This guide outlines the automated test architecture, coverage breakdown, and exact PowerShell commands to run tests across all layers.

---

## 1. Test Suite Architecture

The test suite is structured into four distinct layers:

| Layer | Folder | Focus | Key Assertions |
| :--- | :--- | :--- | :--- |
| **Core Domain** | `tests/core/` | Pure Python domain arithmetic | Decimal precision, conservation formula, 0.45g worked example, hash chain break detection, shared vectors |
| **AI / ML** | `tests/ai/` | Voice parsing, OCR, Agent boundaries | Proposal sentence ("Ramesh ko 50 gram..."), missing field questions, synthetic OCR decoding, LLM mock fallback, agent permission refusal |
| **Backend API** | `tests/backend/` | FastAPI routes, RBAC, Data Isolation | 15 numbered dispute rules, karigar isolation (403), agent cannot self-register, dual approvals, stale draft (409), tamper detection |
| **End-to-End** | `tests/e2e/` | Complete user journey (API level) | The full 50.00g vs 49.85g demonstration flow from issue through dispute, reweigh, resolution, to final settlement and audit check |

---

## 2. Running Tests (PowerShell)

### Run all tests with summary
```powershell
python -m pytest -v
```

### Run only Core Engine tests
```powershell
python -m pytest tests/core/test_core.py -v
```

### Run only AI and Agent tests
```powershell
python -m pytest tests/ai/ -v
```

### Run only Backend & Dispute tests
```powershell
python -m pytest tests/backend/ -v
```

### Run only the End-to-End demonstration test
```powershell
python -m pytest tests/e2e/test_scenario_50_vs_49_85.py -v
```

### Run tests matching a specific keyword (e.g. dispute)
```powershell
python -m pytest -k "dispute" -v
```
