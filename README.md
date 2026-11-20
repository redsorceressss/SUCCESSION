# SUCCESSION

**Dual-Custody Gold Ledger & Workflow Transparency Platform**  
*Team:* **TheMentalist** · *Event:* **Tech 4 Bharat Hackathon 2026**

SUCCESSION is a web application for tracking gold custody workflows across **jewellers**, **karigars**, and **assayers**. It provides role-based operations, versioned/auditable transaction history, evidence handling, confirmation/correction/dispute/settlement workflows, offline-tolerant client behavior for supported actions, and assistive AI utilities (scale-photo OCR, deterministic voice draft parsing, local RAG policy assistance, and a bounded advisory agent) while keeping financial decisions human-confirmed.

> **Status (verified):** maintained automated tests pass (`python -m pytest tests -q` → **177 passed, 0 failed, 0 skipped, 2 warnings**). Fresh-database Alembic migration to head and maintained frontend checks were verified in this environment (details below). **Live browser E2E, live LLM-provider connectivity, production deployment, and PostgreSQL runtime are not verified.**

---

## 1. Problem statement

In jewellery manufacturing, gold issued to artisans and returned as finished/scrap material can differ by small amounts. Manual records and weak evidence trails make discrepancies hard to reconcile, increasing disputes, delay, and loss of trust.

## 2. Solution overview

SUCCESSION provides a shared, role-aware ledger and workflow system that:
- records custody events as structured, traceable transactions with immutable/versioned history;
- uses **Decimal-based** weight/purity calculations (no binary floating-point accounting);
- supports confirmations, corrections, disputes, evidence, and **dual human approval** settlement flows;
- preserves append-only audit/hash-chain integrity for critical records;
- supports an offline-aware queue/sync pattern with idempotent replay for selected safe operations;
- offers **assistive (non-authoritative)** AI tooling.

## 3. Actual roles

- **Jeweller:** creates/manages orders and custody transactions (e.g. issue), participates in confirmations/corrections/disputes/settlements as permitted.
- **Karigar:** participates in assigned order/transaction workflows, returns, confirmations/corrections/disputes/settlements as permitted.
- **Assayer:** performs assigned, independent dispute/reweigh verification tasks within scoped access.
- **Agent (system/advisory role):** restricted backend/automation role for read/remind/draft/log-style assistance; **cannot** approve/confirm/resolve/settle or change financial records.

**Not implemented:** no Admin role/workflow in the current frontend or backend.

## 4. Actual architecture

| Layer | Implementation (in repo) |
|---|---|
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy 2.x, Pydantic v2, PyJWT, Alembic (`backend/app/`) |
| Database | SQLite by default (dev/local); PostgreSQL-compatible URL/config path exists (**not runtime-validated**) |
| Core logic | `core_engine/` (Decimal purity/fine-gold math, conservation/reconciliation, dispute split, integrity/hash utilities) |
| AI/assistive | `ai_engine/` — classical OpenCV/NumPy scale-photo OCR, deterministic voice draft parsing, local BM25 RAG over `docs/**/*.md`, optional OpenAI-compatible LLM client, bounded advisory agent |
| Frontend | Vanilla JavaScript SPA (ES modules), hash router, vendored Tabler UI assets, PWA/service worker, offline queue/sync modules (`frontend/`) |
| Tests | `pytest` suite under `tests/`, frontend/Node checks (`tests/frontend/*.mjs`, `tests/test_frontend_*.js`), browser-audit artifacts/scripts |

**High-level flow:** browser SPA/PWA → FastAPI (JWT/RBAC) → SQLAlchemy/DB, with evidence storage, assistive AI modules, and core-engine business/integrity rules. Frontend offline queue replays selected supported mutations via idempotent backend contracts.

## 5. Core workflows (implemented)

- Authentication and role-scoped authorization (backend-enforced)
- Order creation and custody transactions (issue/return) with Decimal weights/karat/scrap handling
- Versioned transaction history, confirmations, and correction requests (traceable, no silent overwrite)
- Dispute workflow: original entry preserved, claimed values/notes/evidence/reweigh support, disputed quantity held from automatic settlement, human-authorized resolution only
- Assayer assignment and independent verification (scoped access/independence checks)
- Settlement drafting and **dual human approval** (agent may draft where allowed, cannot approve/settle)
- Passbook/reconciliation summaries, notifications, and append-only audit logging/verification
- Offline-tolerant queue/sync for selected supported operations

**Critical safety example (verified by implementation and tests):** if a jeweller records **50.00 g** and karigar reports **49.85 g**, the original entry remains preserved, the disagreement is recorded and auditable, the disputed amount is held (not auto-settled), and only authorized human decisions can resolve it. The advisory AI cannot approve or settle disputes/transactions.

## 6. AI/ML capabilities and limitations

| Component | Actual behavior | Limitations / boundaries |
|---|---|---|
| **Scale-photo OCR** (`POST /scale-photos`, `ai_engine/ocr/`) | Classical preprocessing + seven-segment/heuristic decoding, confidence/abstention, `MATCH/MISMATCH/UNREADABLE`, evidence persistence and audit logging, manual confirmation required | **Not a trained jewellery-specific OCR model; no measured in-domain accuracy.** Assistive only; never auto-updates authoritative financial records. |
| **Voice draft parsing** (`POST /voice/parse`, `ai_engine/voice/`) | Deterministic rule-based parsing to an **editable draft** (known-karigar context, missing/ambiguity handling, readback/confirmation cues); parse step saves nothing | **Not a validated ASR/NLU model.** Human review/acknowledgement and explicit authorized submission required. Browser/client speech input and backend parsing are separate concerns. |
| **RAG policy assistant** (`POST /ai/query`, `ai_engine/rag/`, `backend/app/services/rag_service.py`) | Local **BM25** retrieval over indexed `docs/**/*.md`, chunk citations/grounding, prompt-injection neutralization, server-derived tenant scope, deterministic excerpt fallback; optional OpenAI-compatible LLM generation when configured | **Not a vector database.** Answers limited to available corpus; no proven private shop-level corpus isolation claim. Informational only (cannot approve/modify/confirm records). |
| **Advisory agent** (`ai_engine/agent/`) | Permission-gated read/remind/summarise/draft/log workflows; neutral summaries/guardrails | Cannot confirm/approve/reject/resolve/settle disputes, edit values, or override human decisions (enforced in agent and backend controls). |
| **Optional LLM integration** (`ai_engine/llm.py`) | OpenAI-compatible `/chat/completions` client with timeout, optional auth, strict parsing/validation, and fail-closed fallback to deterministic behavior | External, config-dependent; responses not authoritative. **Live provider not verified** in this environment unless explicitly configured and tested. |

## 7. Setup

### Prerequisites
- Python 3.11+ (verified in this environment with Python 3.13)
- `pip` and dependencies from `requirements.txt`
- Node.js (for maintained frontend/JS checks)
- Modern browser for frontend/PWA usage

### Backend (from repo root `succession/`)
```powershell
# 1) Create local env file (do not commit .env)
Copy-Item .env.example .env

# 2) Install dependencies
python -m pip install -r requirements.txt

# 3) (Recommended for fresh DB) apply migrations to head
python -m alembic upgrade head

# 4) Start API server
python -m uvicorn backend.app.main:app --reload --port 8000
```
- Health: `http://127.0.0.1:8000/health`
- OpenAPI/Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### Frontend
```powershell
# From repo root, serve static frontend
python -m http.server 3000 --directory frontend
```
Open `http://localhost:3000`. The frontend API base resolves in order: `window.__SUCCESSION_CONFIG__.apiBase` → `localStorage['succession_api_base']` → `http://127.0.0.1:8000` (default).

## 8. Environment variables

Configure in local `.env` (see `.env.example`; never commit secrets).

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development`/`production` mode (production enforces secure `SECRET_KEY`) |
| `SECRET_KEY` | JWT signing secret (**must be strong/unique in production**) |
| `DATABASE_URL` | DB connection string (default SQLite path; PostgreSQL URL possible but not runtime-validated) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (required for production; dev defaults to local origins) |
| `ACCESS_TOKEN_MINUTES` | JWT access token lifetime |
| `RATE_LIMIT` | Global API rate limit (e.g. `60/minute`) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Evidence/upload storage path and size limit |
| `TOLERANCE_G`, `SCALE_MATCH_G` | Accounting/reconciliation and OCR match tolerances |
| `LLM_ENABLED`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Optional OpenAI-compatible provider for LLM-enhanced `/ai/query` generation |
| `WHISPER_ENABLED`, `WHISPER_MODEL` | Optional speech-to-text scaffold settings (**not wired into live `/voice/parse` API path**) |
| `AGENT_LOGIN`, `AGENT_PASSWORD`, `API_BASE_URL` | Advisory agent/agent-account helper configuration (provide securely in local `.env` when needed; `.env.example` uses placeholders) |

> **Development helper scripts (disposable DB only):** `scripts/seed_demo.py` and `scripts/create_agent.py` are development utilities. They require explicit safeguards, securely provided credentials, and an already-migrated disposable database (never `swarn.db`, `uploads/`, or production data). See `docs/setup.md` for verified usage and safety constraints.

**LLM provider (optional):** SUCCESSION’s RAG works without an external LLM via deterministic retrieval/excerpt fallback. To enable LLM-enhanced answers, configure a reachable OpenAI-compatible endpoint exposing `POST {LLM_BASE_URL}/chat/completions` with a valid `LLM_MODEL` and credentials as required (`LLM_API_KEY` sent as bearer token when set). If configuration/credentials are unavailable or requests fail, the system falls back to safe deterministic behavior (no credentials should be logged or committed).

## 9. Database migrations

- Alembic config: `alembic.ini` (`script_location = backend/alembic`)
- Revisions: `backend/alembic/versions/` (head includes `0002_assayer_assignments`)
- **Fresh database (verified on disposable SQLite DB in this environment):** `alembic upgrade head` applies base→head, creates expected tables (including `assayer_assignments` and indexes), and records the head revision.
- **Existing local databases:** schema/state may vary (e.g. databases created via app metadata or missing `alembic_version` stamp). Inspect and align carefully; **do not downgrade/reset or blindly modify existing data**.

## 10. Testing and verification

```powershell
# Maintained backend/AI/core/e2e test suite
python -m pytest tests -q

# Focused AI/ML checks (examples)
python -m pytest tests/backend/test_scale_photo_endpoint.py tests/backend/test_voice_parse_endpoint.py tests/backend/test_ai_rag_tenant_isolation.py tests/ai/test_rag.py tests/ai/test_parse_rules.py tests/ai/test_agent.py -q

# Maintained frontend/JS checks
node tests/test_frontend_hash_vectors.js
node tests/test_frontend_offline_qr.js
node tests/test_frontend_offline_signing.js
node tests/frontend/test_offline_queue_sync_behavior.mjs
node tests/frontend/test_rag_assistant_panel.mjs
node tests/frontend/test_scale_ocr_review.mjs
node tests/frontend/test_voice_draft_review.mjs
```

**Latest verified results (this environment):**
- `python -m pytest tests -q`: **177 passed, 0 failed, 0 skipped, 2 warnings** (exit 0)
- Focused AI/ML subset above: **54 passed, 2 warnings**
- Maintained frontend/Node checks above: **all passed**
- Disposable fresh-DB migration check: **`alembic upgrade head` succeeded; head recorded; `assayer_assignments` present; app import compatible** (temporary DB removed after verification)
- Browser-based E2E/manual UI runtime: **not performed**

## 11. Frontend/backend integration notes

- **Auth:** JWT bearer token (`Authorization: Bearer <token>`), frontend session stored in local storage; 401 clears session/redirects to login.
- **CORS:** dev allows local origins; production requires explicit `ALLOWED_ORIGINS`.
- **API compatibility:** frontend calls existing FastAPI routes for orders/transactions/confirmations/corrections/disputes/evidence/reweigh/assayer/settlements/passbook/notifications/sync and assistive endpoints (`/scale-photos`, `/voice/parse`, `/ai/query`).
- **Uploads:** multipart file uploads for scale photos and dispute evidence (subject to backend validation/size/type rules); uploads not queued for offline replay.
- **Offline/sync:** client queues only selected supported mutations with idempotent replay contracts; backend `/sync` enforces idempotency/ownership and conflict handling.
- **Roles:** UI guards reflect roles, but **backend authorization is authoritative**.

## 12. Demonstration workflow (suggested)

1. Authenticate as jeweller/karigar/assayer (existing, authorized demo accounts/data in target environment).
2. Create/select an order and record an issue transaction (Decimal weight/karat).
3. Perform return/confirmation/correction steps as applicable.
4. Demonstrate dispute: **50.00 g recorded vs 49.85 g claimed** → original preserved, discrepancy visible/auditable, disputed amount held, evidence/notes/reweigh as permitted, resolution by authorized humans only, then dual-approved settlement when valid.
5. Show passbook/history/audit traceability.
6. (Optional, assistive) show OCR review, voice draft parsing/editing, and RAG policy query with human-gated/informational boundaries.

*Use only safe, pre-existing demo data/accounts; do not invent credentials.*

## 13. Known limitations

- **No Admin role** implemented.
- **Live browser E2E/manual UI verification not performed** in this pass (API/automated checks verified).
- **Live LLM provider responses not verified** without valid configured credentials; deterministic fallback remains available.
- **OCR:** classical/assistive only, no in-domain trained model or measured jewellery-scale accuracy.
- **Voice:** deterministic draft parsing, not a validated ASR/NLU product; requires human review/explicit submit.
- **RAG:** local BM25 over global docs (not vector DB), corpus-limited answers, no private shop-level isolation claim.
- **Offline:** partial support for selected operations; full device/browser behavior not runtime-verified.
- **PostgreSQL/deployment/production hardening** not validated.
- Repository may contain in-progress changes, historical reports, and local artifacts; curate carefully before sharing/publishing. Existing local DB migration stamp state may differ from fresh Alembic-managed databases.

## 14. Team

- **Project:** SUCCESSION
- **Team:** TheMentalist
- **Event:** Tech 4 Bharat Hackathon 2026
