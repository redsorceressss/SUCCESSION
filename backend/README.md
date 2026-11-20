# SUCCESSION Backend Engine

## Overview
The `backend/` folder provides the production-grade FastAPI REST API, database models, business logic services, and authentication/authorization layer for the shared gold ledger.

---

## Directory Structure
```
backend/
├── app/
│   ├── main.py           # FastAPI entry point, CORS, table initialization, router wiring
│   ├── config.py         # App configuration loaded from .env with typed Decimal settings
│   ├── database.py       # SQLAlchemy 2.0 engine, SessionLocal, get_db, DecimalString type
│   ├── security.py       # Salted scrypt password hashing & PyJWT token handling
│   ├── deps.py           # Reusable dependencies (get_current_user, require_roles, PARTY)
│   ├── models.py         # 18 relational database tables + immutable table guard
│   ├── schemas.py        # Pydantic v2 schemas with exact Decimal Weight constraints
│   ├── routes/           # Modular REST routers
│   │   ├── auth.py       # /auth/register, /auth/login, /me
│   │   ├── orders.py     # /orders endpoints
│   │   ├── transactions.py # /transactions/issue, /return, /confirm, /disputes
│   │   ├── disputes.py   # /disputes, /notes, /evidence, /reweigh, /resolutions
│   │   ├── passbook.py   # /passbook/{karigar_id} with strict privacy isolation
│   │   ├── settlements.py# /settlements draft & human dual-approval
│   │   ├── scale.py      # /scale-photos OCR upload & comparison
│   │   ├── voice.py      # /voice/parse voice Khata draft parser (saves nothing!)
│   │   ├── sync.py       # /sync idempotent offline batch replay
│   │   └── misc.py       # /health, /notifications, /audit/verify, /agent/*
│   └── services/         # Encapsulated domain business logic
│       ├── common.py     # Serialization, string formatting, party access checks
│       ├── accounts.py   # Passbook calculations, settlement draft builder, fingerprinting
│       ├── disputes.py   # Dispute creation, held gram calculation, resolution logic
│       ├── versioning.py # Immutable TransactionVersion appending & hash chaining
│       ├── state.py      # State machine legal transitions guard
│       ├── evidence.py   # Magic-byte file validation and safe disk storage
│       └── audit.py      # Append-only SHA-256 audit log and chain verification
├── uploads/              # Local evidence storage (git-ignored)
└── requirements.txt      # Backend dependency manifest
```

---

## Core Security & Business Rules Enforced
1. **Decimal Precision**: All gold weights and scrap values are stored as `DecimalString` and validated via Pydantic `Decimal`. Floating-point calculations are strictly forbidden.
2. **Immutable Audit Trail**: Tables in `IMMUTABLE = (TransactionVersion, Confirmation, DisputeNote, EvidenceFile, SettlementApproval, AuditEvent)` reject any `UPDATE` or `DELETE` attempt at the ORM layer.
3. **Agent Privilege Isolation**: Endpoints with the `PARTY = require_roles("jeweller", "karigar")` dependency reject requests signed with the `agent` role with `403 Forbidden`. The agent can draft settlements but cannot approve them.
4. **Dispute Isolation**: Disputed weight differences are isolated into `SettlementHold` rows and cannot be settled without explicit human agreement or `accept_partial=True`.
