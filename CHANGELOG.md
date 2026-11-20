# Project Changelog & Organization Record

All notable consolidation, reorganization, and evaluation infrastructure changes are documented in this file.

---

## [Frontend & Core Systems Development Phase] — 2026-11-10

### Added
* **Member 1 (Frontend Development):**
  * Created full vanilla HTML5/CSS3/JavaScript Progressive Web Application in `frontend/`.
  * Implemented responsive SPA shell with `index.html`, `manifest.webmanifest`, and `service-worker.js`.
  * Modular design system in `frontend/css/`: `main.css`, `layout.css`, `components.css`, `forms.css`, `responsive.css`.
  * Hash-based router (`frontend/js/router.js`) with client-side RBAC route guards (`jeweller`, `karigar`).
  * Central API Client (`frontend/js/api.js`) handling JWT bearer tokens, multipart file uploads, and offline fallback.
  * Precision Decimal string validator (`frontend/js/validators.js`) preventing binary floating point inaccuracy in gold weight accounting.
  * Multilingual vernacular support (`frontend/js/i18n/`) in English (`en.json`), Hindi (`hi.json`), and Kannada (`kn.json`).
  * 16 complete workflow screens in `frontend/js/screens/`: `login`, `register`, `dashboard`, `orders`, `order_detail`, `issue`, `return`, `transaction_detail`, `confirmation`, `correction`, `dispute`, `evidence`, `passbook`, `settlement`, `notifications`, `settings`.
  * Voice & OCR assistance integration (`frontend/js/services/`): Web Speech API recognizer, Vernacular parse-rules integration, scale display photo witness OCR upload.
* **Member 4 (Core Systems & Offline Architecture):**
  * Implemented browser-side offline module suite in `frontend/js/offline/`:
    * `db.js`: IndexedDB transactional wrapper (`pending_ops`, `cached_transactions`, `sync_log`).
    * `queue.js`: Enqueues operations with UUID v4 idempotency keys and canonical SHA-256 payload hashing.
    * `sync.js`: Background queue synchronizer with exponential backoff and idempotent `409 Conflict` resolution.
    * `connectivity.js`: Network status tracker with periodic heartbeat ping to `/misc/ping`.
    * `qr.js`: Compact versioned QR handshake codec matching Python `core_engine.qr_payload` specification.
    * `signing.js`: Web Crypto API ECDSA NIST P-256 digital signature generator for offline non-repudiation.
* **Integration Tests:**
  * Created `tests/test_frontend_hash_vectors.js` confirming 100% cryptographic parity between JS canonical serialization and Python test vectors in `tests/vectors/hash_vectors.json`.
  * Created `tests/test_frontend_offline_qr.js` validating QR handshake schema compliance and exact string-based decimal subtraction ($50.0000 - 49.8500 = 0.1500$).
* **Engineering Documentation:**
  * Created `docs/frontend_guide.md`, `docs/core_engine_guide.md`, `docs/frontend_api_mapping.md`, and `docs/offline_sync_guide.md`.

---

## [Consolidation & Cleanup Phase] — 2026-11-10

### Added
* **Central Directory Infrastructure:**
  * Created specialized subdirectories under `docs/`: `project_overview/`, `problem_statement/`, `proposed_solution/`, `architecture/`, `technical_documentation/`, `api_documentation/`, `ai_ml_documentation/`, `database_documentation/`, `testing_documentation/`, `hackathon_submissions/`, `presentations/`, `research_and_references/`.
  * Created project-internal `brain/` directory with structured subfolders: `project_notes/`, `planning/`, `prompts/`, `decisions/`, `archived_notes/`.
  * Created `archive/investigation_scripts/` to store all 31 temporary investigation and exploratory scripts created during dataset research.
  * Created `assets/images/`, `assets/diagrams/`, and `database/documentation/`.
* **Central Master Documentation:**
  * Created `README.md` explaining the full architecture, startup commands, Swagger access, and test execution.
  * Created `PROJECT_STRUCTURE.md` containing a full tree layout and directory inventory.
  * Created `PROJECT_STATUS.md` with an honest breakdown of implemented, tested, and pending components.
  * Created `FINAL_PROJECT_CONSOLIDATION_REPORT.md` auditing all file movements, deletions, and verification steps.
* **Brain & Architectural Records:**
  * Added `brain/prompts/MASTER_DEVELOPMENT_PROMPT.md`, `REAL_WORLD_VALIDATION_PROMPT.md`, `CONSOLIDATION_CLEANUP_PROMPT.md`.
  * Added Architecture Decision Records: `brain/decisions/DECISION_RECORD_DATASETS.md` and `DECISION_RECORD_ARCHITECTURE.md`.
  * Added conceptual notes: `brain/project_notes/SWARNSAAKSHI_CORE_CONCEPT.md` and `EVALUATION_FINDINGS_SUMMARY.md`.

### Consolidated & Relocated
* **External Files Moved to Repository:**
  * Moved `submissionideatemplate.docx` from parent `TECH4BHARAT/` directory into `docs/hackathon_submissions/`.
  * Moved `dataset_shortlist_v2.md` from external Anti-Gravity Brain into `brain/archived_notes/`.
  * Moved `dataset_shortlist_v3.md` from external Anti-Gravity Brain into `brain/planning/` and `docs/ai_ml_documentation/`.
  * Moved 3 user-uploaded research PDFs from external Anti-Gravity Brain into `docs/research_and_references/`.
  * Relocated 31 scratch investigation scripts from external Brain scratch into `archive/investigation_scripts/`.
* **Internal Documentation Categorization:**
  * Categorized `architecture.md` and `conservation.md` into `docs/architecture/`.
  * Categorized `api_contract.md` into `docs/api_documentation/`.
  * Categorized `database.md` into `docs/database_documentation/` and `database/documentation/`.
  * Categorized `setup.md`, `limits.md`, `dispute_workflow.md`, and `ai_workflow.md` into `docs/technical_documentation/`.
  * Categorized `TEST_GUIDE.md`, `ocr_testing_guide.md`, and `demo.md` into `docs/testing_documentation/`.
  * Categorized `evaluation_report.md` into `docs/ai_ml_documentation/`.
  * Categorized research playbooks into `docs/research_and_references/`.

### Preserved
* **Zero Production Code Changes:** All backend endpoints, database models, schemas, and AI modules left intact.
* **Database Boundary:** Preserved `swarn.db` without inserting any benchmark or test records.
* **Regression Baseline:** Executed full regression test suite (`tests/`), confirming all **75/75 tests passing in 7.41s**.
