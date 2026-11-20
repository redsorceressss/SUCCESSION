# Project Structure & Architecture Inventory

This document details the complete organizational directory layout of the `succession` central project repository.

```text
succession/
│
├── README.md                           # Master project guide, setup, and execution manual
├── PROJECT_STATUS.md                   # Comprehensive implementation & testing status report
├── PROJECT_STRUCTURE.md                # This directory hierarchy and file purpose inventory
├── CHANGELOG.md                        # Consolidation log and file relocation history
├── FINAL_PROJECT_CONSOLIDATION_REPORT.md # Final auditing and cleanup report
├── requirements.txt                    # Python dependencies
├── alembic.ini                         # Database migration configuration
├── swarn.db                            # SQLite development database (Isolated from evaluation)
├── .env.example                        # Example environment configuration
├── .gitignore                          # Git exclusion rules
│
├── backend/                            # FastAPI Backend Service
│   ├── alembic/                        # Database migration versions
│   │   ├── env.py
│   │   └── versions/0001_initial_schema.py
│   └── app/                            # Application code
│       ├── main.py                     # App entry point, CORS, and router registration
│       ├── config.py                   # Environment and application settings
│       ├── database.py                 # SQLAlchemy engine and session factory
│       ├── deps.py                     # FastAPI dependency injection (DB sessions, auth user)
│       ├── models.py                   # ORM models (Users, Orders, Transactions, Disputes, etc.)
│       ├── schemas.py                  # Pydantic validation schemas
│       ├── security.py                 # Password hashing (bcrypt) and JWT token creation
│       ├── routes/                     # API Route Handlers
│       │   ├── auth.py                 # Registration, login, token refresh
│       │   ├── orders.py               # Order lifecycle (create, list, detail)
│       │   ├── transactions.py         # Dual-custody issue/return/scrap transactions
│       │   ├── disputes.py             # Dispute filing, evidence attachment, mutual resolution
│       │   ├── passbook.py             # Karigar/jeweller passbook and running gold balance
│       │   ├── scale.py                # Digital scale image upload & OCR endpoint
│       │   ├── voice.py                # Audio entry upload and text parsing endpoint
│       │   ├── settlements.py          # Settlement calculations and draft reviews
│       │   ├── sync.py                 # Offline-sync transaction ingestion
│       │   └── misc.py                 # System health and ping checks
│       └── services/                   # Business Services
│           ├── accounts.py             # Balance aggregation and ledger verification
│           ├── audit.py                # Immutable audit event logging
│           ├── common.py               # Shared utility routines
│           ├── disputes.py             # Dispute state machine transitions
│           ├── evidence.py             # Photo/audio evidence storage management
│           ├── state.py                # Transaction lifecycle status checks
│           └── versioning.py           # Optimistic locking and revision tracking
│
├── frontend/                           # Vanilla JS Progressive Web Application (PWA)
│   ├── index.html                      # PWA root shell & modular stylesheet links
│   ├── manifest.webmanifest            # Web app manifest
│   ├── service-worker.js               # Service Worker precaching & offline fetch
│   ├── css/                            # Modular styling (main, layout, components, forms, responsive)
│   ├── assets/                         # Icons and static media
│   └── js/                             # ES Modules
│       ├── app.js                      # Bootstrap & application lifecycle orchestrator
│       ├── router.js                   # Hash-based SPA router with RBAC route guards
│       ├── api.js                      # Centralized API client with JWT & offline queue
│       ├── auth.js                     # Token and user profile storage
│       ├── state.js                    # Reactive state bus
│       ├── validators.js               # Decimal string precision validators
│       ├── i18n/                       # Vernacular JSON resource files (en, hi, kn)
│       ├── components/                 # UI components (header, nav, badge, modal, toast, stat_card)
│       ├── services/                   # Voice, OCR, Hash, Export, Notification services
│       ├── offline/                    # db.js, queue.js, sync.js, connectivity.js, qr.js, signing.js
│       └── screens/                    # 16 complete workflow screens (login, orders, issue, return, etc.)
│
├── ai_engine/                          # Deterministic AI & ML Subsystems
│   ├── common/                         # Shared schemas, exceptions, and logging
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── schemas.py
│   ├── rag/                            # Retrieval-Augmented Generation
│   │   ├── ingestion.py                # Chunking with shop_id tenant scoping
│   │   ├── retrieval.py                # BM25 local retriever with stemming & stopword filter
│   │   └── rag_engine.py               # Grounded Q&A engine with prompt-injection sanitizer
│   ├── ocr/                            # Computer Vision Scale Reader
│   │   ├── seven_segment.py            # Geometric contour and segment lookup decoder
│   │   ├── read_display.py             # High-level scale reader returning Reading(Decimal)
│   │   ├── preprocess.py               # Deskewing, glare detection, and binarization
│   │   ├── confidence.py               # Decimal-based reading confidence heuristics
│   │   └── compare.py                  # Decimal weight tolerance comparison
│   ├── voice/                          # Multilingual Voice Khata
│   │   ├── parse_rules.py              # Rule-based NLP parser with ambiguity prompts
│   │   ├── stt.py                      # Speech-to-text adapter (faster-whisper / Web Speech)
│   │   ├── readback.py                 # Structured verbal/text transaction confirmation
│   │   ├── validation.py               # Purity and weight sanity constraints
│   │   └── language.py                 # Language detection and token normalization
│   ├── agent/                          # Autonomous Agentic AI Workflows
│   │   ├── gateway.py                  # Least-privilege API gateway for agent operations
│   │   ├── permissions.py              # Cryptographic operation whitelist (read/remind/draft)
│   │   ├── workflows.py                # Reconciliation and overdue order workflows
│   │   ├── drafts.py                   # Automated settlement draft generator
│   │   ├── reminders.py                # WhatsApp/SMS reminder dispatching
│   │   ├── risk_detection.py           # Anomaly and gold loss pattern analyzer
│   │   ├── scheduler.py                # Periodic background task scheduler (APScheduler)
│   │   ├── run_once.py                 # One-off agent execution trigger
│   │   ├── memory.py                   # Ephemeral task state storage
│   │   └── summaries.py                # Daily ledger reconciliation summaries
│   └── evaluation/                     # Initial Synthetic Benchmarks
│       ├── ocr_eval.py                 # 5-sample OpenCV canvas synthetic benchmark
│       ├── voice_eval.py               # 12-sample text parser benchmark
│       └── rag_eval.py                 # 5-scenario retrieval & safety benchmark
│
├── core_engine/                        # Mathematical & Ledger Invariant Rules
│   ├── conservation.py                 # Gold mass balance equation (Issued = Returned + Wastage + Scrap)
│   ├── purity.py                       # Decimal fineness conversion (14K, 18K, 20K, 22K, 24K)
│   ├── disputes.py                     # Variance calculation and tolerance evaluation
│   ├── integrity.py                    # SHA-256 block hash verification
│   ├── qr_payload.py                   # Cryptographic QR payload generation for offline slips
│   └── sync_rules.py                   # Idempotent offline reconciliation conflict resolver
│
├── tests/                              # Automated Pytest Regression Suite (75/75 Passing)
│   ├── conftest.py                     # Pytest fixtures (in-memory DB, test clients, world fixture)
│   ├── ai/                             # AI subsystem regression tests
│   │   ├── test_agent.py
│   │   ├── test_ocr_llm.py
│   │   ├── test_parse_rules.py
│   │   └── test_rag.py
│   ├── backend/                        # API & Security integration tests
│   │   ├── test_auth_rbac.py
│   │   ├── test_dispute_workflow.py
│   │   └── test_settlement_agent_audit.py
│   ├── core/                           # Conservation and business logic tests
│   │   └── test_core.py
│   ├── e2e/                            # End-to-end user scenario tests
│   │   └── test_scenario_50_vs_49_85.py # Full 50.00g vs 49.85g dispute scenario
│   └── vectors/                        # Deterministic test hash vectors
│       └── hash_vectors.json
│
├── real_world_evaluation/              # Real-World Public Dataset Evaluation Framework
│   ├── README.md                       # Evaluation guide and execution instructions
│   ├── real_world_report.md            # Master empirical evaluation report
│   ├── dataset_sources.md              # Provenance, licensing, and attribution register
│   ├── evaluation_config.yaml          # Evaluation parameters and path configurations
│   ├── runners/                        # Independent Benchmark Runners
│   │   ├── eval_rag_real.py            # BIS Statutory Hallmarking benchmark runner
│   │   ├── eval_ocr_real.py            # Mendeley 169-photo 7-segment benchmark runner
│   │   ├── eval_voice_real.py          # Hinglish 18-dialogue workshop benchmark runner
│   │   └── eval_agent_safety_real.py   # Prompt injection & gateway permissions runner
│   ├── datasets/                       # External and Team-Collected Datasets
│   │   ├── rag/bis_summaries/          # BIS Hallmarking FAQs and 10 query pairs
│   │   ├── rag/jewellery_invoices/     # Anonymized invoice schema & protocol (Empty)
│   │   ├── ocr/mendeley_energy_meter/  # 169 real camera photos + COCO labels
│   │   ├── ocr/scale_photos/           # Workshop scale photos schema & protocol (Empty)
│   │   ├── voice/fleurs_hi_in_pilot/   # FLEURS Hindi test split records
│   │   ├── voice/fleurs_kn_in_pilot/   # FLEURS Kannada test split records
│   │   ├── voice/hinglish_text_cases/  # 18 realistic workshop transaction dialogues
│   │   └── agent/deepset_injections/   # Deepset hold documentation
│   └── results/                        # Machine-Readable JSON Benchmark Outputs
│       ├── rag_evaluation_results.json
│       ├── ocr_evaluation_results.json
│       ├── voice_evaluation_results.json
│       └── agent_safety_results.json
│
├── docs/                               # Comprehensive Project Documentation
│   ├── architecture/                   # Architecture & conservation design
│   │   ├── architecture.md
│   │   └── conservation.md
│   ├── technical_documentation/        # Setup, limits, and workflows
│   │   ├── setup.md
│   │   ├── limits.md
│   │   ├── dispute_workflow.md
│   │   └── ai_workflow.md
│   ├── api_documentation/              # OpenAPI contracts and payload schemas
│   │   └── api_contract.md
│   ├── ai_ml_documentation/            # Evaluation reports and dataset specifications
│   │   ├── evaluation_report.md
│   │   └── dataset_shortlist_v3.md
│   ├── database_documentation/         # Schema, migrations, and relationship models
│   │   └── database.md
│   ├── testing_documentation/          # Testing procedures and demo guides
│   │   ├── TEST_GUIDE.md
│   │   ├── ocr_testing_guide.md
│   │   └── demo.md
│   ├── hackathon_submissions/          # Hackathon submission templates and ideas
│   │   └── submissionideatemplate.docx
│   └── research_and_references/        # Official research playbooks and source PDFs
│       ├── SUCCESSION Every Gram, Witnessed.pdf
│       ├── SUCCESSION_Backend_AI_Playbook.pdf
│       ├── TECH4BHARAT_DEVELOPMENT_HANDBOOK.pdf
│       ├── media_1794282187534_0367177c.pdf
│       ├── media_1794282187534_df2981fa.pdf
│       └── media_1794282187535_6e004c88.pdf
│
├── brain/                              # Consolidated Brain Artifacts, Decisions & Prompts
│   ├── prompts/                        # Master prompt records
│   │   ├── MASTER_DEVELOPMENT_PROMPT.md
│   │   ├── REAL_WORLD_VALIDATION_PROMPT.md
│   │   └── CONSOLIDATION_CLEANUP_PROMPT.md
│   ├── decisions/                      # Architecture Decision Records (ADRs)
│   │   ├── DECISION_RECORD_DATASETS.md
│   │   └── DECISION_RECORD_ARCHITECTURE.md
│   ├── project_notes/                  # Core conceptual and empirical summaries
│   │   ├── SWARNSAAKSHI_CORE_CONCEPT.md
│   │   └── EVALUATION_FINDINGS_SUMMARY.md
│   ├── planning/                       # Milestone and dataset planning
│   │   └── dataset_shortlist_v3.md
│   └── archived_notes/                 # Superseded iterative artifacts
│       └── dataset_shortlist_v2.md
│
├── database/                           # Central Database Documentation & Migrations
│   └── documentation/
│       └── database.md
│
├── scripts/                            # Operational & Developer Scripts
│   ├── create_agent.py                 # Agent user bootstrap utility
│   ├── run_dev.ps1                     # Windows dev environment launcher
│   ├── seed_demo.py                    # Demonstration transaction seeder
│   ├── test_scale_image.py             # CLI scale photo evaluation utility
│   ├── verify_setup.py                 # Environment verification routine
│   └── consolidate_files.py            # Consolidation script
│
├── archive/                            # Archived Investigation & Exploratory Artifacts
│   └── investigation_scripts/          # 31 Python scripts from dataset exploration
│       ├── check_faster_whisper.py
│       ├── check_fsspec.py
│       ├── check_modules.py
│       ├── check_tar_size.py
│       ├── download_mendeley.py
│       ├── dump_mendeley_html.py
│       ├── inspect_api_call.py
│       ├── inspect_bundle.py
│       ├── inspect_coco_mapping.py
│       ├── inspect_files_payload.py
│       ├── inspect_hf_fleurs_files.py
│       ├── inspect_mendeley.py
│       ├── inspect_mendeley_data.py
│       ├── inspect_mendeley_html.py
│       ├── inspect_mendeley_js.py
│       ├── inspect_mendeley_next.py
│       ├── inspect_mendeley_zip.py
│       ├── inspect_tsv.py
│       ├── print_error.py
│       ├── search_bundle.py
│       ├── search_mp.py
│       ├── test_dataset_endpoints.py
│       ├── test_fleurs_hf_api.py
│       ├── test_fleurs_nodecode.py
│       ├── test_fleurs_stream.py
│       ├── test_hffs_parquet.py
│       ├── test_hf_range.py
│       ├── test_mendeley_api.py
│       ├── test_mendeley_doi.py
│       ├── test_mendeley_public_api.py
│       └── verify_mendeley_extracted.py
│
└── uploads/                            # Runtime Evidence Uploads (Git-ignored)
```
