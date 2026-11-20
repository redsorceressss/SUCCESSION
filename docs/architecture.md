# System Architecture & Technical Design

## 1. Executive Summary & Core Mission
**Challenge:** Tech4Bharat 2026 — JanAI Mass Entrepreneurship Challenge — Theme 2: Jeweltech (PS 2.2: Agentic AI)  
**Core Promise:** *Every gram accounted for. Every important entry witnessed by both parties. No forced acceptance.*

This project provides a voice-first, offline-ready shared gold ledger designed for jewellers and artisan goldsmiths (*karigars*). It replaces traditional informal paper slips and verbal agreements with a transparent, verifiable, and mutually witnessed digital ledger.

---

## 2. Core Architectural Principles & Boundaries

1. **Exact Gold Weight Calculations (`Decimal` Only)**:
   - Weights and pure-gold fractions are never represented as floating-point numbers (`float`).
   - All arithmetic uses Python's standard `decimal.Decimal` with 4 decimal places internally (`0.0001` g = 0.1 mg) and exact string representation in JSON payloads and database persistence (`DecimalString`).
   
2. **Immutable Audit Trail & Hash-Chained Integrity**:
   - Recorded weights and transactions are never overwritten or deleted (`UPDATE` and `DELETE` queries are strictly prohibited on ledger history).
   - Any modification or correction results in a new version (`TransactionVersion`), linked by SHA-256 hash chains starting from a known `GENESIS` block (`"0" * 64`).
   - Changes can be deterministically verified across the entire ledger history.

3. **Mandatory Human Dual-Confirmation**:
   - The AI agent is strictly **advisory**. It can retrieve information, draft reminders, calculate mathematical balances via `core_engine`, and prepare settlement proposals.
   - The AI **cannot** confirm transactions, approve corrections, resolve disputes, release holds, or finalize settlements.
   - Both jeweller and karigar must explicitly confirm entries and settlements.

4. **Privacy and Role-Based Access Control (RBAC)**:
   - Strict tenant and object-level isolation: A karigar can **only** inspect their own account and transactions.
   - A jeweller can only view orders and karigars linked to their shop.
   - Agent accounts operate through a dedicated service token with strict endpoint restrictions (default-deny).

---

## 3. High-Level Modular Monorepo Architecture

```
succession/
│
├── core_engine/                  # Pure Python domain logic (No web, No DB, No I/O)
│   ├── purity.py                 # Karat-to-fineness & fine gold conversions (Decimal)
│   ├── conservation.py           # Gold conservation equation & tolerance reconciliation
│   ├── disputes.py               # Disputed quantity isolation & settlement holds
│   ├── integrity.py              # Canonical JSON serialization & SHA-256 hash-chaining
│   ├── sync_rules.py             # Idempotency, conflict detection & safe replay
│   └── qr_payload.py             # Versioned QR handshake payload & offline verification
│
├── ai_engine/                    # Modular AI/ML components (Does not import backend internals)
│   ├── voice/                    # Voice Khata: STT, rule parsing, LLM fallback, readback
│   │   ├── parse_rules.py        # Deterministic rule parser (Hinglish/English numbers & terms)
│   │   ├── parse_llm.py          # Optional OpenAI-compatible LLM extraction with validation
│   │   ├── readback.py           # Confirmation sentences (English, Hindi, Kannada)
│   │   ├── validation.py         # Missing-field extraction & question generation
│   │   └── stt.py                # Optional server-side faster-whisper transcription
│   ├── ocr/                      # Scale-Photo Witness: CV display reader & verification
│   │   ├── preprocess.py         # Image normalization, grayscale, thresholding, denoising
│   │   ├── seven_segment.py      # Classic CV 7-segment illuminated segment decoder
│   │   ├── read_display.py       # Image-to-Decimal OCR engine
│   │   ├── compare.py            # MATCH / MISMATCH / UNREADABLE comparison logic
│   │   └── confidence.py         # Confidence thresholding & safe abstention
│   ├── agent/                    # Tool-restricted Advisory Agentic System
│   │   ├── permissions.py        # Code-enforced ALLOWED/FORBIDDEN boundary (default-deny)
│   │   ├── gateway.py            # Authenticated HTTP gateway to backend (no direct DB access)
│   │   ├── workflows.py          # Deadline checks, reconciliation drafts, dispute reminders
│   │   ├── drafts.py             # Settlement proposal drafting (grounded in core_engine)
│   │   ├── run_once.py           # CLI runner for Windows Task Scheduler / Cron
│   │   └── scheduler.py          # Optional in-process APScheduler daemon
│   ├── rag/                      # Optional RAG Knowledge Engine (Module D)
│   │   ├── ingestion.py          # Document loader & chunker for operational guidelines
│   │   ├── retrieval.py          # Keyword & hybrid search over approved docs
│   │   └── rag_engine.py         # Grounded explanation assistant with strict boundaries
│   └── llm.py                    # Generic OpenAI-compatible client wrapper with validation
│
├── backend/                      # FastAPI Application
│   └── app/
│       ├── main.py               # App factory, middleware, CORS, route registration
│       ├── config.py             # Typed configuration (.env loading, tolerances)
│       ├── database.py           # SQLAlchemy session, engine, DecimalString column
│       ├── security.py           # Scrypt hashing, PyJWT creation and verification
│       ├── deps.py               # Reusable dependencies (get_current_user, require_roles)
│       ├── models/               # SQLAlchemy 2.0 ORM models (18 relational tables)
│       ├── schemas/              # Pydantic v2 schemas for input validation
│       ├── services/             # Core business logic (disputes, accounts, audit, etc.)
│       └── routes/               # Modular REST endpoints
│
├── tests/                        # Comprehensive automated test suite
│   ├── core/                     # Unit tests for pure Python gold arithmetic
│   ├── ai/                       # Voice parser, OCR decoder, agent permission tests
│   ├── backend/                  # Auth, RBAC, dispute workflows, settlements, sync tests
│   └── e2e/                      # Full end-to-end user scenario tests (50.00g vs 49.85g)
│
└── docs/                         # Comprehensive architectural and integration specifications
```

---

## 4. Component Interaction Diagram

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        PWA["Frontend PWA / Mobile Web"]
        Worker["Offline Service Worker & IndexedDB"]
    end

    subgraph GatewayBoundary["API & Security Boundary"]
        FastAPI["FastAPI Backend (REST API)"]
        AuthService["Auth & RBAC (PyJWT + Scrypt)"]
    end

    subgraph CoreEngineTier["Core Domain Logic (Pure Python)"]
        Purity["Purity & Fine Gold Converter"]
        Conservation["Conservation Engine (Reconciliation)"]
        DisputeMath["Dispute Isolator & Holds"]
        Integrity["SHA-256 Hash Chain Integrity"]
        SyncRules["Offline Sync Rules & QR Handshake"]
    end

    subgraph AIEngineTier["AI / ML Advisory Services"]
        VoiceParser["Voice Khata Parser (Rules + LLM Fallback)"]
        ScaleOCR["Scale-Photo CV Reader (7-Segment Decoder)"]
        AgentRunner["Agentic AI Scheduler & Workflows"]
        RAGModule["Operational RAG Knowledge Engine"]
    end

    subgraph Storage["Data Tier"]
        DB[(SQLite / PostgreSQL Database)]
        EvidenceStore[(Secure File Storage: uploads/)]
    end

    PWA -->|REST + JWT| FastAPI
    Worker -->|POST /sync| FastAPI
    FastAPI --> AuthService
    FastAPI --> CoreEngineTier
    FastAPI --> DB
    FastAPI --> EvidenceStore

    FastAPI -->|POST /voice/parse| VoiceParser
    FastAPI -->|POST /scale-photos| ScaleOCR

    AgentRunner -->|HTTP Gateway (Restricted Agent JWT)| FastAPI
    RAGModule -.->|Advisory Inquiries| FastAPI
```

---

## 5. Non-Negotiable Boundaries Summary

| Feature | Allowed | Strictly Forbidden |
| :--- | :--- | :--- |
| **Gold Arithmetic** | Python `Decimal`, quantized to 4 decimal places | `float`, JavaScript floating point arithmetic |
| **Ledger Changes** | Creating a new `TransactionVersion` with audit hash | `UPDATE` or `DELETE` on existing transaction records |
| **Agent Action** | Proposing drafts, sending notifications, checking deadlines | Approving settlements, resolving disputes, changing weights |
| **Data Access** | Jeweller views own shop; Karigar views own account | Karigar accessing other karigars' passbooks or orders |
| **Scale Photo** | Validating scale display against entered weight | Claiming image proves gold purity or chemical composition |
