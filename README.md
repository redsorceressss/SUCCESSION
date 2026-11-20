# SUCCESSION

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/7d52c89f-f600-47e5-9de5-ba207fd4ada3" alt="SUCCESSION — Main application interface" width="100%">
      <br>
      <strong>SUCCESSION — Application Overview</strong>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/6118e49c-ccce-4506-8c24-82285bf90b5b" alt="SUCCESSION — Platform dashboard and workflows" width="100%">
      <br>
      <strong>SUCCESSION — Platform Dashboard</strong>
    </td>
  </tr>
</table>

**Dual-Custody Gold Ledger & Workflow Transparency Platform**

**Team:** TheMentalist  
**Event:** Tech 4 Bharat Hackathon 2026

SUCCESSION is a web application for tracking gold custody workflows across **jewellers, karigars, and assayers**. It provides role-based operations, versioned and auditable transaction history, evidence handling, confirmation/correction/dispute/settlement workflows, offline-tolerant client behavior for supported actions, and assistive AI utilities — scale-photo OCR, deterministic voice draft parsing, local RAG policy assistance, and a bounded advisory agent — while keeping financial decisions human-confirmed.

> **Project Status — Verified**
>
> - Maintained automated tests: **177 passed, 0 failed, 0 skipped, 2 warnings**
> - Fresh-database Alembic migration to head: verified in a disposable environment
> - Maintained frontend checks: passed
> - Live browser E2E, live LLM-provider connectivity, production deployment, and PostgreSQL runtime: **not verified**

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Actual Roles](#3-actual-roles)
4. [Architecture](#4-architecture)
5. [Core Workflows](#5-core-workflows)
6. [AI/ML Capabilities and Limitations](#6-aiml-capabilities-and-limitations)
7. [Getting Started](#7-getting-started)
8. [Environment Variables](#8-environment-variables)
9. [Database Migrations](#9-database-migrations)
10. [Testing and Verification](#10-testing-and-verification)
11. [Frontend/Backend Integration](#11-frontendbackend-integration)
12. [Demonstration Workflow](#12-demonstration-workflow)
13. [Known Limitations](#13-known-limitations)
14. [Team](#14-team)

---

## 1. Problem Statement

In jewellery manufacturing, gold issued to artisans and returned as finished or scrap material can differ by small amounts.

Manual records, fragmented communication, and weak evidence trails make discrepancies difficult to reconcile, increasing disputes, delays, and loss of trust between stakeholders.

Traditional workflows often lack a shared, traceable record of:

- How much gold was issued.
- How much material was returned.
- Whether both parties agree on recorded weights.
- What evidence supports a transaction.
- Whether a discrepancy is under review.
- Who authorized a correction or settlement.

SUCCESSION addresses these gaps through a structured, role-aware gold custody and transaction workflow.

## 2. Solution Overview

SUCCESSION provides a shared, role-aware ledger and workflow system that:

- Records custody events as structured transactions with immutable/versioned history.
- Uses **Decimal-based** weight and purity calculations instead of binary floating-point accounting.
- Supports confirmations, correction requests, disputes, evidence, and **dual human approval** settlement flows.
- Preserves append-only audit/hash-chain integrity for critical records.
- Supports an offline-aware queue and synchronization pattern with idempotent replay for selected safe operations.
- Offers assistive, non-authoritative AI tooling.
- Maintains human oversight for important financial decisions.

The objective is not merely to digitize a ledger, but to make every important gold transaction traceable, reviewable, and accountable.

## 3. Actual Roles

SUCCESSION has three operational user roles and a restricted system advisory role.

### Jeweller
- Creates and manages orders.
- Initiates gold custody transactions, including gold issuance.
- Participates in confirmations, corrections, disputes, and settlements as permitted.
- Reviews transaction history, passbook entries, and reconciliation information.

### Karigar
- Participates in assigned order and transaction workflows.
- Records returns of finished or scrap material.
- Reviews issued and returned quantities.
- Participates in confirmations, corrections, disputes, and settlements as permitted.

### Assayer
- Performs assigned independent dispute and reweigh verification tasks.
- Reviews relevant evidence and weighment information.
- Provides verification within scoped permissions.
- Cannot independently authorize financial settlement.

### Agent — Restricted System/Advisory Role
The advisory agent is a restricted backend/automation role for read, reminder, summary, draft, and logging-style assistance.

It **cannot** approve, confirm, resolve, settle, or modify authoritative financial records.

> **Not implemented:** There is no Admin role or Admin dashboard in the current frontend or backend.

## 4. Architecture

### Technology Stack

| Layer | Implementation |
|---|---|
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy 2.x, Pydantic v2, PyJWT, Alembic |
| Database | SQLite by default for development/local use; PostgreSQL-compatible URL/configuration path exists but is not runtime-validated |
| Core Logic | Decimal-based purity/fine-gold mathematics, conservation/reconciliation, dispute splitting, integrity and hash utilities |
| AI/Assistive | Classical OpenCV/NumPy scale-photo OCR, deterministic voice draft parsing, local BM25 RAG, optional OpenAI-compatible LLM client, bounded advisory agent |
| Frontend | Vanilla JavaScript SPA using ES modules, hash router, vendored Tabler UI assets, PWA/service worker, offline queue/sync modules |
| Testing | Pytest suite, frontend/Node checks, and browser-audit artifacts/scripts |

### High-Level Architecture

```text
                 USER INTERFACE
          Browser SPA / Progressive Web App
                         |
                         v
                Authentication & RBAC
                         |
                         v
                  FASTAPI BACKEND
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
      SQLAlchemy     Core Engine     AI Services
          |              |              |
          v              v              +---- Scale OCR
       Database      Decimal Math      +---- Voice Parsing
          |          Reconciliation    +---- Local RAG
          |          Audit / Hashing   +---- Advisory Agent
          |
          v
     Transaction History
     Evidence & Custody Records
     Disputes & Settlements
```

The frontend communicates with the FastAPI backend through authenticated API requests. The backend enforces role-based permissions and delegates accounting, integrity, and assistive AI operations to their respective modules.

Offline synchronization is supported for selected operations through an idempotent queue and replay mechanism.

## 5. Core Workflows

The following workflows are implemented:

- Authentication and role-scoped authorization, enforced by the backend.
- Order creation and custody transactions, including issue and return operations.
- Decimal-based weight, karat, and scrap-material calculations.
- Versioned transaction history, confirmations, and correction requests without silent overwrites.
- Dispute workflows with original-entry preservation, claimed values, notes, evidence, and reweigh support.
- Assayer assignment and independent verification with scoped access and independence checks.
- Settlement drafting and dual human approval.
- Passbook and reconciliation summaries.
- Notifications and append-only audit logging/verification.
- Offline-tolerant queue and synchronization for selected supported operations.

### Example: Gold Weight Discrepancy

Consider a transaction in which:

- The Jeweller records **50.00 g** issued.
- The Karigar reports **49.85 g**.

SUCCESSION preserves the original entry and records the disagreement rather than silently overwriting the transaction.

The workflow supports:

1. Recording the discrepancy.
2. Preserving the original transaction.
3. Adding notes and supporting evidence.
4. Requesting reweighing or independent verification where applicable.
5. Holding the disputed quantity from automatic settlement.
6. Allowing only authorized human decisions to resolve the dispute.

The advisory AI cannot approve, resolve, or settle the disagreement.

This ensures that discrepancies remain visible and auditable until the appropriate stakeholders complete the review.

## 6. AI/ML Capabilities and Limitations

SUCCESSION incorporates assistive AI utilities to reduce manual effort while retaining human control over authoritative records.

| Component | Actual Behavior | Limitations and Boundaries |
|---|---|---|
| **Scale-Photo OCR** (`POST /scale-photos`) | Classical image preprocessing and seven-segment/heuristic decoding, confidence and abstention handling, MATCH/MISMATCH/UNREADABLE results, evidence persistence and audit logging, manual confirmation required. | Not a trained jewellery-specific OCR model. No measured in-domain accuracy. Never automatically updates authoritative financial records. |
| **Voice Draft Parsing** (`POST /voice/parse`) | Deterministic rule-based parsing for Hindi/Kannada number and weight phrases, editable drafts, known-karigar context, ambiguity handling, and readback/confirmation cues. Parsing itself saves nothing. | Not a validated ASR/NLU model. Human review and explicit authorized submission are required. Browser/client speech input and backend parsing are separate concerns. |
| **RAG Policy Assistant** (`POST /ai/query`) | Local BM25 retrieval over indexed Markdown policy documents, chunk citations/grounding, prompt-injection neutralization, server-derived tenant scope, and deterministic excerpt fallback. Optional OpenAI-compatible LLM generation when configured. | Not a vector database. Answers are limited to the available corpus. No proven private shop-level corpus-isolation claim. Informational only; cannot approve or modify records. |
| **Advisory Agent** (`ai_engine/agent/`) | Permission-gated read, remind, summarize, draft, and log workflows with bounded state transitions and guardrails. | Cannot confirm, approve, reject, resolve, or settle disputes; edit financial values; or override human decisions. |
| **Optional LLM Integration** (`ai_engine/llm.py`) | OpenAI-compatible `/chat/completions` client with timeout, optional authentication, strict parsing/validation, and fail-closed fallback to deterministic behavior. | Configuration-dependent. Live provider connectivity is not verified unless explicitly configured and tested. Responses are not authoritative. |

### AI Safety Principles

All AI functionality is assistive.

- AI-generated information is subject to human review.
- OCR output does not automatically replace recorded weights.
- Voice parsing produces editable drafts rather than automatically submitting transactions.
- RAG answers are informational and grounded in available documentation.
- The advisory agent cannot authorize financial actions.
- Disputes and settlements remain subject to authorized human decisions.

## 7. Getting Started

### Prerequisites

- Python 3.11 or later.
- `pip` and dependencies listed in `requirements.txt`.
- Node.js for maintained frontend/JavaScript checks.
- A modern browser for frontend and PWA usage.

### 7.1 Clone the Repository

```powershell
git clone https://github.com/redsorceressss/SUCCESSION.git
cd SUCCESSION
```

### 7.2 Configure the Environment

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and configure the required values for your local environment.

**Never commit `.env` or expose API credentials.**

### 7.3 Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

### 7.4 Initialize a Fresh Database

For a fresh database, apply the migrations:

```powershell
python -m alembic upgrade head
```

### 7.5 Start the Backend

From the repository root:

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

Backend endpoints:

| Service | URL |
|---|---|
| Health Check | http://127.0.0.1:8000/health |
| Swagger / OpenAPI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |

### 7.6 Start the Frontend

Open another terminal at the repository root:

```powershell
python -m http.server 3000 --directory frontend
```

Open the application:

```text
http://localhost:3000
```

The frontend API base resolves in this order:

1. `window.__SUCCESSION_CONFIG__.apiBase`
2. `localStorage['succession_api_base']`
3. `http://127.0.0.1:8000` as the default.

> **Note:** Backend and frontend must both be running for authenticated application workflows to function correctly.

## 8. Environment Variables

Configure these values in your local `.env` file. Refer to `.env.example` for the available configuration placeholders.

| Variable | Purpose |
|---|---|
| `APP_ENV` | Application environment: development or production. Production enforces a secure `SECRET_KEY`. |
| `SECRET_KEY` | JWT signing secret. Must be strong and unique in production. |
| `DATABASE_URL` | Database connection string. Defaults to a local SQLite path; PostgreSQL URL support exists but is not runtime-validated. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. Required for production; development defaults to local origins. |
| `ACCESS_TOKEN_MINUTES` | JWT access-token lifetime. |
| `RATE_LIMIT` | Global API rate limit, for example `60/minute`. |
| `UPLOAD_DIR` | Evidence and upload storage directory. |
| `MAX_UPLOAD_MB` | Maximum permitted upload size. |
| `TOLERANCE_G` | Accounting/reconciliation weight tolerance. |
| `SCALE_MATCH_G` | Scale OCR matching tolerance. |
| `LLM_ENABLED` | Enables optional LLM-enhanced RAG generation. |
| `LLM_BASE_URL` | OpenAI-compatible provider base URL. |
| `LLM_API_KEY` | Optional LLM provider authentication key. |
| `LLM_MODEL` | Configured LLM model name. |
| `WHISPER_ENABLED` | Optional speech-to-text scaffold setting; not wired into the live `/voice/parse` API path. |
| `WHISPER_MODEL` | Optional speech-to-text model setting. |
| `AGENT_LOGIN` | Advisory agent/helper account configuration. |
| `AGENT_PASSWORD` | Advisory agent/helper account credential. |
| `API_BASE_URL` | API base URL used by agent/helper scripts. |

### Optional LLM Provider

SUCCESSION's RAG functionality works without an external LLM through deterministic retrieval and excerpt fallback.

To enable LLM-enhanced answers, configure a reachable OpenAI-compatible endpoint exposing:

```text
POST {LLM_BASE_URL}/chat/completions
```

Provide a valid `LLM_MODEL` and credentials as required. When configured, `LLM_API_KEY` is sent as a bearer token.

If configuration, credentials, or provider connectivity are unavailable, the system falls back to safe deterministic behavior.

**Credentials must never be logged, committed, or exposed publicly.**

### Development Helper Scripts

The following scripts are development utilities:

- `scripts/seed_demo.py`
- `scripts/create_agent.py`

They require explicit safeguards, securely provided credentials, and an already-migrated disposable database.

Never run them against `swarn.db`, production data, or real upload/evidence directories.

See `docs/setup.md` for verified usage and safety constraints.

## 9. Database Migrations

### Alembic Configuration

- Configuration: `alembic.ini`
- Migration directory: `backend/alembic`
- Current migration head includes `0002_assayer_assignments`.

### Fresh Database

A fresh disposable SQLite database was used to verify:

- `alembic upgrade head` completes successfully.
- The expected tables are created.
- `assayer_assignments` and its indexes are present.
- The migration head is recorded.
- Application imports remain compatible.

### Existing Local Databases

Existing databases may have different schema or migration-stamp states. For example, some databases may have been created through application metadata rather than an Alembic-managed initialization.

Inspect existing database state carefully before applying migrations.

**Do not downgrade, reset, or blindly modify existing databases or their records.**

## 10. Testing and Verification

### Backend, AI, Core, and E2E Tests

Run the maintained Python test suite from the repository root:

```powershell
python -m pytest tests -q
```

### Focused AI/ML Tests

```powershell
python -m pytest tests/backend/test_scale_photo_endpoint.py tests/backend/test_voice_parse_endpoint.py tests/backend/test_ai_rag_tenant_isolation.py tests/ai/test_rag.py tests/ai/test_parse_rules.py tests/ai/test_agent.py -q
```

### Frontend and JavaScript Tests

Run the maintained checks individually:

```powershell
node tests/test_frontend_hash_vectors.js

node tests/test_frontend_offline_qr.js

node tests/test_frontend_offline_signing.js

node tests/frontend/test_offline_queue_sync_behavior.mjs

node tests/frontend/test_rag_assistant_panel.mjs

node tests/frontend/test_scale_ocr_review.mjs

node tests/frontend/test_voice_draft_review.mjs
```

### Latest Verified Results

| Test Category | Result |
|---|---|
| Backend tests | 110 passed |
| AI tests | 47 passed |
| Core tests | 10 passed |
| E2E/API workflow tests | 10 passed |
| **Total Python tests** | **177 passed, 0 failed, 0 skipped** |
| Python warnings | 2 |
| Frontend hash-vector checks | Passed |
| Offline QR and payload checks | Passed |
| ECDSA P-256 signing and tamper rejection | Passed |
| Offline queue and sync behavior | 16/16 passed |
| RAG assistant panel tests | Passed |
| Scale OCR review tests | Passed |
| Voice draft review tests | Passed |
| Fresh disposable database migration | Passed |

The focused AI/ML subset reported **54 passed, 2 warnings**.

> These results describe the verified development environment. They do not imply that every production deployment, external provider, or browser/device combination has been validated.

## 11. Frontend/Backend Integration

### Authentication

- JWT bearer-token authentication.
- Requests use `Authorization: Bearer <token>`.
- Frontend session information is stored in local storage.
- Unauthorized `401` responses clear the session and redirect to login.

### CORS

- Development configuration allows local origins.
- Production requires explicitly configured `ALLOWED_ORIGINS`.

### API Integration

The frontend integrates with the existing FastAPI routes for:

- Authentication.
- Orders and transactions.
- Confirmations and correction requests.
- Disputes, notes, and evidence.
- Reweigh and assayer verification.
- Settlements.
- Passbook and notifications.
- Offline synchronization.
- Scale-photo OCR.
- Voice draft parsing.
- AI/RAG queries.

### Evidence Uploads

- Multipart uploads are supported for scale photos and dispute evidence.
- Backend validation and upload-size restrictions apply.
- Uploads are not queued for offline replay.

### Offline and Synchronization

The client queues only selected supported mutations with idempotent replay contracts.

The backend `/sync` endpoint enforces idempotency, ownership, and conflict handling.

Offline support is partial and does not imply that every workflow or upload is available without connectivity.

### Role Authorization

Frontend guards provide role-specific navigation and user experience.

However, **backend authorization is authoritative**. Frontend visibility alone is not considered a security boundary.

## 12. Demonstration Workflow

A suggested demonstration sequence:

1. Authenticate as a Jeweller, Karigar, or Assayer using authorized demo accounts and data in the target environment.
2. Create or select an order.
3. Record a gold issue transaction with the relevant weight and karat.
4. Demonstrate return and confirmation workflows.
5. Introduce a discrepancy: **50.00 g recorded versus 49.85 g claimed**.
6. Show how the original entry remains preserved and the discrepancy becomes auditable.
7. Demonstrate evidence, notes, and reweigh support where permitted.
8. Show that the disputed amount is held from automatic settlement.
9. Complete the authorized human resolution workflow where appropriate.
10. Demonstrate dual-approved settlement and passbook/history records.
11. Optionally demonstrate OCR review, voice draft parsing, and RAG policy assistance.

Use only safe, pre-existing demo data and authorized accounts.

Do not assume or invent credentials.

## 13. Known Limitations

The following limitations should be considered when evaluating or deploying SUCCESSION:

- **No Admin role:** No Admin dashboard or Admin workflow is implemented.
- **Browser E2E:** Live browser E2E/manual UI verification is not claimed as part of the automated test results documented above.
- **LLM provider:** Live external LLM responses are not verified without valid configured credentials and a reachable provider. Deterministic fallback remains available.
- **OCR:** The current implementation is classical and assistive, not a trained jewellery-specific model. No in-domain accuracy benchmark is claimed.
- **Voice:** The current backend parser is deterministic draft parsing, not a validated ASR/NLU product. Human review and explicit submission are required.
- **RAG:** Local BM25 retrieval over Markdown documentation, not a vector database. Answers are corpus-limited; no private shop-level isolation claim is made.
- **Offline support:** Partial support for selected operations. Full behavior across all devices and browsers is not runtime-verified.
- **PostgreSQL:** A compatible configuration path exists, but PostgreSQL runtime behavior is not validated.
- **Production deployment:** Production deployment and full production hardening are not verified.
- **Existing databases:** Local migration-stamp and schema states may differ. Existing data must be inspected before migration or modification.

## 14. Team

| Detail | Information |
|---|---|
| Project | **SUCCESSION** |
| Project Category | Gold Custody, Ledger & Workflow Transparency |
| Team | **TheMentalist** |
| Event | **Tech 4 Bharat Hackathon 2026** |

---

**SUCCESSION — Every Transaction. Every Gram. Accounted For.**

