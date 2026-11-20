# SUCCESSION

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/7d52c89f-f600-47e5-9de5-ba207fd4ada3" alt="SUCCESSION — Application Overview" width="100%">
      <br>
      <strong>SUCCESSION — Application Overview</strong>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/b9088a94-f646-4ff6-99ca-667e3d740104" alt="SUCCESSION — Platform Dashboard" width="100%">
      <br>
      <strong>SUCCESSION — Platform Dashboard</strong>
    </td>
  </tr>
</table>

<p align="center">
  <strong>Dual-Custody Gold Ledger &amp; Workflow Transparency Platform</strong>
  <br>
  Every Transaction. Every Gram. Accounted For.
</p>

<p align="center">
  <strong>Team:</strong> TheMentalist &nbsp;|&nbsp;
  <strong>Event:</strong> Tech 4 Bharat Hackathon 2026
</p>

SUCCESSION is a role-based web application designed to bring transparency, accountability, and traceability to gold custody workflows involving **jewellers, karigars, and assayers**.

It provides structured transaction records, versioned history, evidence management, confirmation and correction workflows, dispute handling, independent verification, and controlled settlement processes.

The platform also incorporates assistive AI utilities, including scale-photo OCR, deterministic voice draft parsing, local RAG-based policy assistance, and a bounded advisory agent — while keeping important financial decisions under human control.

> **Project Verification Status**
>
> - Python automated test suite: **177 passed, 0 failed, 0 skipped**
> - Python test warnings: **2**
> - Fresh disposable-database Alembic migration: **Verified**
> - Maintained frontend checks: **Passed**
> - Live LLM-provider connectivity: **Not verified**
> - PostgreSQL runtime: **Not verified**
> - Production deployment: **Not verified**
> - Live browser E2E/manual UI verification: **Not claimed by the automated test results**

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [System Architecture](#4-system-architecture)
5. [Core Features and Workflows](#5-core-features-and-workflows)
6. [AI/ML Capabilities and Limitations](#6-aiml-capabilities-and-limitations)
7. [Getting Started](#7-getting-started)
8. [Environment Configuration](#8-environment-configuration)
9. [Database Migrations](#9-database-migrations)
10. [Testing and Verification](#10-testing-and-verification)
11. [Frontend and Backend Integration](#11-frontend-and-backend-integration)
12. [Demonstration Workflow](#12-demonstration-workflow)
13. [Known Limitations and Future Scope](#13-known-limitations-and-future-scope)
14. [Continuous Development](#14-continuous-development)
15. [Team](#15-team)

---

## 1. Problem Statement

Gold jewellery manufacturing involves multiple stakeholders, particularly jewellers, karigars, and assayers.

During manufacturing, gold is issued to artisans and later returned as finished jewellery, scrap, or other material. Even small differences in recorded and returned weights can create disagreements.

Traditional manual workflows often rely on handwritten records, fragmented communication, and disconnected evidence. This makes it difficult to establish a reliable shared history of transactions.

Common challenges include:

- Inconsistent records of gold issued and returned.
- Weight discrepancies between stakeholders.
- Limited visibility into transaction status.
- Difficulty tracking corrections and disagreements.
- Missing or disconnected supporting evidence.
- Unclear responsibility for verification and settlement.
- Lack of a consistent, auditable transaction history.

These gaps can lead to disputes, delays, reconciliation difficulties, and reduced trust between stakeholders.

**SUCCESSION addresses this problem by introducing a structured, role-aware system for recording, reviewing, verifying, and reconciling gold custody transactions.**

## 2. Solution Overview

SUCCESSION provides a shared gold custody ledger and transaction workflow platform.

Its primary objectives are to:

- Digitally record gold issuance, returns, and custody events.
- Maintain versioned transaction history instead of silently overwriting important records.
- Use Decimal-based calculations for weight, purity, and fine-gold accounting.
- Support confirmation, correction requests, and dispute workflows.
- Preserve supporting evidence, notes, and verification records.
- Enable independent assayer verification where applicable.
- Support controlled settlement with dual human approval.
- Maintain audit and integrity records for critical operations.
- Provide offline-tolerant synchronization for selected supported operations.
- Offer assistive AI tools without granting AI authority over financial decisions.

The central principle is simple:

**Every important transaction should be recorded, reviewable, traceable, and accountable to the people involved.**

## 3. User Roles and Permissions

SUCCESSION has three operational user roles and a restricted system advisory role.

### Jeweller

The Jeweller manages the business-side custody workflow.

Responsibilities include:

- Creating and managing orders.
- Initiating gold issuance transactions.
- Recording relevant transaction details.
- Reviewing returned material and reconciliation information.
- Participating in confirmations, correction requests, and disputes.
- Reviewing passbook entries and transaction history.
- Participating in authorized settlement workflows.

### Karigar

The Karigar participates in assigned manufacturing and custody workflows.

Responsibilities include:

- Viewing assigned orders and transactions.
- Reviewing issued gold quantities.
- Recording finished or scrap material returns.
- Reviewing transaction and weight information.
- Confirming entries or requesting corrections.
- Raising disputes and providing supporting information.
- Participating in authorized reconciliation and settlement workflows.

### Assayer

The Assayer provides independent verification within assigned permissions.

Responsibilities include:

- Reviewing assigned verification and dispute tasks.
- Examining relevant weight information and supporting evidence.
- Performing assigned reweigh or verification activities.
- Recording verification outcomes.
- Supporting dispute resolution through independent assessment.

An Assayer cannot independently authorize financial settlement.

### Restricted Advisory Agent

The advisory agent is a restricted backend/system role intended for bounded assistance.

It supports operations such as:

- Reading permitted information.
- Generating summaries.
- Creating reminders.
- Preparing drafts.
- Recording permitted logs.

It cannot approve, confirm, reject, resolve, settle, or modify authoritative financial records.

> **Role clarification:** SUCCESSION currently implements Jeweller, Karigar, and Assayer as its operational user roles. There is no Admin role or Admin dashboard in the current application.

## 4. System Architecture

### Technology Stack

| Layer | Technologies |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| ORM and Validation | SQLAlchemy 2.x, Pydantic v2 |
| Authentication | JWT, PyJWT |
| Database Migrations | Alembic |
| Database | SQLite for local development; PostgreSQL-compatible configuration path not runtime-validated |
| Core Accounting | Python Decimal arithmetic, reconciliation, fine-gold calculations |
| Integrity | Audit logging, hash utilities, transaction history |
| Computer Vision | OpenCV, NumPy, heuristic scale-photo OCR |
| Voice Processing | Deterministic rule-based draft parsing |
| Retrieval | Local BM25 document retrieval |
| AI Integration | Optional OpenAI-compatible LLM client and bounded advisory agent |
| Frontend | Vanilla JavaScript, ES modules, HTML, CSS |
| UI Components | Vendored Tabler assets and custom styles |
| Application Delivery | PWA, service worker, offline queue and synchronization |
| Testing | Pytest and maintained JavaScript/Node checks |

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
             +-------------+-------------+
             |             |             |
             v             v             v
        SQLAlchemy     Core Engine    AI Services
             |             |             |
             v             v             +---- Scale-Photo OCR
          Database    Decimal Math       +---- Voice Draft Parsing
             |        Reconciliation     +---- Local BM25 RAG
             |        Audit / Hashing    +---- Advisory Agent
             |
             v
       Transaction History
       Evidence & Custody Records
       Disputes & Settlements
```

The frontend communicates with the FastAPI backend through authenticated API requests.

The backend is responsible for authoritative authorization, transaction processing, accounting operations, evidence handling, and workflow validation.

The core engine handles accounting and reconciliation logic, while the AI modules provide assistive functionality.

Selected offline-capable operations use a client-side queue and synchronization mechanism with idempotent replay handling.

## 5. Core Features and Workflows

### 5.1 Authentication and Role-Based Access

- JWT-based authentication.
- Role-scoped application navigation.
- Backend-enforced authorization.
- Protected transaction and workflow operations.

### 5.2 Gold Custody Transactions

- Order creation and management.
- Gold issuance records.
- Finished and scrap material returns.
- Weight and purity calculations.
- Transaction history and reconciliation.

### 5.3 Confirmation and Correction

Important transaction entries support structured review.

Stakeholders can:

- Confirm recorded information.
- Request corrections.
- Raise disputes.

Corrections are handled through traceable workflow operations rather than silently replacing the original record.

### 5.4 Dispute Management

Dispute workflows support:

- Preservation of the original transaction.
- Recording disputed or claimed values.
- Notes and supporting evidence.
- Reweigh requests.
- Assigned assayer verification.
- Controlled resolution.

Disputed quantities are protected from automatic settlement.

### 5.5 Evidence and Audit Trail

- Supporting evidence uploads.
- Transaction-linked notes.
- Versioned history.
- Audit logging.
- Hash and integrity utilities.
- Verification and reconciliation records.

### 5.6 Assayer Verification

- Scoped assayer assignments.
- Independent verification tasks.
- Relevant evidence and weighment review.
- Verification outcomes.
- Restrictions against unauthorized settlement approval.

### 5.7 Settlement and Passbook

- Settlement drafting.
- Dual human approval.
- Dispute-aware reconciliation.
- Passbook and transaction summaries.
- Historical transaction visibility.

### 5.8 Offline-Tolerant Operations

Selected supported operations use:

- Client-side mutation queues.
- Idempotent replay.
- Synchronization handling.
- Ownership and conflict checks.

Offline support is partial; not every operation or evidence upload is available without connectivity.

### Example: A Gold Weight Discrepancy

Consider the following situation:

- The Jeweller records **50.00 g** issued.
- The Karigar reports **49.85 g**.

The difference is not silently overwritten or automatically settled.

SUCCESSION preserves the original record and provides a structured review workflow:

1. The discrepancy is recorded.
2. The original transaction remains preserved.
3. The parties can provide notes and supporting evidence.
4. Reweighing or independent verification can be requested.
5. The disputed quantity is held from automatic settlement.
6. Authorized stakeholders review and resolve the disagreement.
7. Settlement proceeds only through the applicable human approval workflow.

The advisory AI cannot independently approve or resolve the dispute.

This ensures that disagreements remain visible and traceable until the appropriate stakeholders complete the review.

## 6. AI/ML Capabilities and Limitations

SUCCESSION incorporates assistive AI utilities to reduce manual effort and improve access to information.

These components are designed to support users, not replace human verification or authorize financial decisions.

| Component | Current Implementation | Limitations and Safety Boundaries |
|---|---|---|
| **Scale-Photo OCR** (`POST /scale-photos`) | Classical image preprocessing and seven-segment/heuristic decoding. Provides confidence and abstention handling, MATCH/MISMATCH/UNREADABLE outcomes, evidence persistence, and audit logging. | Not a trained jewellery-specific OCR model. No measured in-domain accuracy. Manual confirmation remains necessary. |
| **Voice Draft Parsing** (`POST /voice/parse`) | Deterministic rule-based parsing for supported Hindi/Kannada number and weight phrases. Produces editable drafts with ambiguity handling and confirmation cues. | Not a validated ASR/NLU model. Parsing itself does not save or submit transactions. |
| **RAG Policy Assistant** (`POST /ai/query`) | Local BM25 retrieval over indexed Markdown policy documents, with source references, prompt-injection neutralization, server-derived tenant scope, and deterministic excerpt fallback. | Not a vector database. Answers are limited to the indexed corpus. Private shop-level corpus isolation is not claimed as proven. |
| **Advisory Agent** (`ai_engine/agent/`) | Permission-gated read, reminder, summary, draft, and logging-style assistance with bounded state transitions. | Cannot approve, confirm, reject, resolve, or settle disputes, or modify authoritative financial records. |
| **Optional LLM Integration** (`ai_engine/llm.py`) | OpenAI-compatible `/chat/completions` client with timeout handling, optional authentication, response validation, and deterministic fallback. | Configuration-dependent. Live external provider connectivity is not verified unless separately configured and tested. |

### AI Safety Principles

All AI functionality is assistive and human-gated.

- OCR output does not automatically replace recorded weights.
- Voice parsing creates editable drafts rather than automatically submitting transactions.
- RAG responses provide informational assistance based on available documentation.
- AI-generated information remains subject to human review.
- The advisory agent cannot authorize financial actions.
- Dispute resolution and settlement remain under authorized human control.

**AI assists the workflow; it does not become the authority over the ledger.**

## 7. Getting Started

### Prerequisites

- Python 3.11 or later.
- pip.
- Node.js for maintained frontend/JavaScript checks.
- A modern web browser.

### 7.1 Clone the Repository

```powershell
git clone https://github.com/redsorceressss/SUCCESSION.git
cd SUCCESSION
```

### 7.2 Create the Environment File

```powershell
Copy-Item .env.example .env
```

Edit `.env` and configure the required values for your local environment.

**Never commit `.env` files or expose API credentials.**

### 7.3 Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

### 7.4 Initialize a Fresh Database

For a fresh database, apply the available migrations:

```powershell
python -m alembic upgrade head
```

See the database migration section before applying migrations to an existing database.

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

Open a second terminal from the repository root:

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

> **Important:** Both the frontend and backend must be running for authenticated application workflows to function correctly.

## 8. Environment Configuration

Configure local values in `.env`, using `.env.example` as the reference.

| Variable | Purpose |
|---|---|
| `APP_ENV` | Application environment: development or production. |
| `SECRET_KEY` | JWT signing secret. Must be strong and unique in production. |
| `DATABASE_URL` | Database connection string. Defaults to a local SQLite path. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. Production requires explicit configuration. |
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

The RAG functionality supports deterministic retrieval and excerpt fallback without an external LLM.

For LLM-enhanced responses, configure a reachable OpenAI-compatible endpoint exposing:

```text
POST {LLM_BASE_URL}/chat/completions
```

Provide the appropriate `LLM_MODEL` and credentials as required.

When configured, `LLM_API_KEY` is sent as a bearer token.

If configuration, credentials, or provider connectivity are unavailable, the system falls back to deterministic behavior.

**Never log, commit, or publicly expose provider credentials.**

### Development Helper Scripts

The following scripts are development utilities:

- `scripts/seed_demo.py`
- `scripts/create_agent.py`

They require appropriate safeguards, securely provided credentials, and an already-migrated disposable database.

Do not run them against `swarn.db`, production data, or real upload/evidence directories.

Refer to `docs/setup.md` for verified usage and safety constraints.

## 9. Database Migrations

### Alembic Configuration

- Configuration: `alembic.ini`
- Migration directory: `backend/alembic`
- Current migration head: `0002_assayer_assignments`

### Fresh Database Verification

A fresh disposable SQLite database was used to verify that:

- `alembic upgrade head` completes successfully.
- Expected tables are created.
- `assayer_assignments` and its indexes are present.
- The migration head is recorded.
- Application imports remain compatible.

### Existing Local Databases

Existing databases may have different schema and migration-stamp states.

Some local databases may have been initialized through application metadata rather than an Alembic-managed initialization.

Inspect the existing database state before applying migrations.

**Do not downgrade, reset, overwrite, or blindly modify existing databases or their records.**

## 10. Testing and Verification

### Python Test Suite

Run the maintained Python test suite from the repository root:

```powershell
python -m pytest tests -q
```

### Focused AI/ML Tests

```powershell
python -m pytest tests/backend/test_scale_photo_endpoint.py tests/backend/test_voice_parse_endpoint.py tests/backend/test_ai_rag_tenant_isolation.py tests/ai/test_rag.py tests/ai/test_parse_rules.py tests/ai/test_agent.py -q
```

### Frontend and JavaScript Checks

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
|---|---:|
| Backend tests | 110 passed |
| AI tests | 47 passed |
| Core tests | 10 passed |
| E2E/API workflow tests | 10 passed |
| **Total Python tests** | **177 passed** |
| Python failures | 0 |
| Python skipped tests | 0 |
| Python warnings | 2 |
| Frontend hash-vector checks | Passed |
| Offline QR and payload checks | Passed |
| ECDSA P-256 signing and tamper rejection | Passed |
| Offline queue and synchronization behavior | 16/16 passed |
| RAG assistant panel tests | Passed |
| Scale OCR review tests | Passed |
| Voice draft review tests | Passed |
| Fresh disposable database migration | Passed |

The focused AI/ML test subset reported **54 passed, 2 warnings**.

These results describe the verified development environment. They do not establish production readiness or guarantee compatibility with every browser, device, database, or external provider.

## 11. Frontend and Backend Integration

### Authentication

- JWT bearer-token authentication.
- Authenticated API requests using `Authorization: Bearer <token>`.
- Frontend session information stored in local storage.
- Unauthorized `401` responses clear the session and redirect to login.

### CORS

- Development configuration supports local origins.
- Production requires explicitly configured `ALLOWED_ORIGINS`.

### API Integration

The frontend integrates with existing FastAPI routes for:

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
- Evidence uploads are not queued for offline replay.

### Offline and Synchronization

Selected supported mutations use a client-side queue with idempotent replay contracts.

The backend `/sync` endpoint enforces idempotency, ownership, and conflict handling.

Offline support is partial and does not mean that every workflow or upload is available without connectivity.

### Role Authorization

Frontend guards control role-specific navigation and user experience.

However, **backend authorization is authoritative**. Frontend visibility alone is not treated as a security boundary.

## 12. Demonstration Workflow

A suggested demonstration sequence:

1. Authenticate as a Jeweller, Karigar, or Assayer using authorized demo accounts and data in the target environment.
2. Create or select an order.
3. Record a gold issuance transaction with its relevant weight and karat.
4. Demonstrate material return and confirmation workflows.
5. Introduce a discrepancy: **50.00 g recorded versus 49.85 g claimed**.
6. Show how the original transaction remains preserved.
7. Demonstrate correction requests, notes, evidence, and dispute tracking.
8. Show reweigh or independent assayer verification where permitted.
9. Demonstrate that the disputed quantity is held from automatic settlement.
10. Complete the authorized human resolution workflow where appropriate.
11. Demonstrate dual-approved settlement and passbook/history records.
12. Optionally demonstrate OCR review, voice draft parsing, and RAG policy assistance.

Use only authorized demo accounts and safe demo data.

Do not assume or invent credentials.

## 13. Known Limitations and Future Scope

SUCCESSION is a working development prototype. The following limitations should be considered when evaluating or deploying the platform.

| Area | Current Status |
|---|---|
| Operational roles | Jeweller, Karigar, and Assayer implemented; no Admin role. |
| Browser E2E | Not claimed as part of the automated test results documented here. |
| LLM provider | Live external provider connectivity not verified. |
| Scale OCR | Classical heuristic implementation; no trained jewellery-specific model or in-domain accuracy benchmark. |
| Voice processing | Deterministic draft parsing; not a validated ASR/NLU product. |
| RAG | Local BM25 retrieval over Markdown documents; not a vector database. |
| RAG isolation | No proven private shop-level corpus-isolation claim. |
| Offline support | Partial support for selected operations; not all workflows and uploads are available offline. |
| PostgreSQL | Compatible configuration path exists; runtime behavior is not validated. |
| Production deployment | Production deployment and full production hardening are not verified. |
| Existing databases | Schema and migration-stamp states may differ; inspect before applying migrations. |

### Future Scope

Potential areas for further development and validation include:

- Training and evaluating a jewellery-specific scale-display OCR model using real-world images.
- Building a validated speech-to-text and multilingual voice workflow.
- Expanding offline capabilities and conflict-resolution testing.
- Strengthening tenant-specific document retrieval and isolation guarantees.
- Validating PostgreSQL compatibility.
- Conducting broader browser, device, and real-world workflow testing.
- Production deployment, security review, monitoring, and operational hardening.

These are future development directions, not claims of already completed functionality.

## 14. Continuous Development

SUCCESSION is an evolving project, and development will continue beyond the hackathon.

We are committed to continuously improving the platform by refining existing workflows, strengthening security and reliability, enhancing AI/ML capabilities, and introducing new features based on testing and real-world feedback.

**Future improvements, bug fixes, feature enhancements, and project updates will be maintained and published through this GitHub repository.**

The current release represents an important development milestone, not the end of the project.

Suggestions, feedback, and constructive contributions are welcome.

## 15. Team

| Detail | Information |
|---|---|
| Project | **SUCCESSION** |
| Project Category | Gold Custody, Ledger & Workflow Transparency |
| Team Name | **TheMentalist** |
| Event | **Tech 4 Bharat Hackathon 2026** |

---

<p align="center">
  <strong>SUCCESSION</strong>
  <br>
  Every Transaction. Every Gram. Accounted For.
  <br><br>
  Built by <strong>Team TheMentalist</strong>
  <br>
  Tech 4 Bharat Hackathon 2026
</p>
