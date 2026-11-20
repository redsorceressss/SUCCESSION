# SUCCESSION Frontend Engineering Guide

## Architecture Overview
The SUCCESSION frontend is a Progressive Web Application (PWA) built without heavy third-party JavaScript frameworks (React/Vue/Angular), ensuring instant loading, zero bundling overhead, high auditability, and resilient offline execution in vernacular Indian jewellery workshops.

### Directory Structure
```
frontend/
├── index.html                   # Core single-page application shell
├── manifest.webmanifest         # PWA installation and branding manifest
├── service-worker.js            # Offline asset caching (stale-while-revalidate)
├── css/
│   ├── main.css                 # Gold heritage color palette & design tokens
│   ├── layout.css               # Responsive dashboard layout, sidebar, headers
│   ├── components.css           # Cards, tables, badges, modals, toasts, QR canvas
│   ├── forms.css                # Form controls, AI assist panels (voice & OCR)
│   └── responsive.css           # Mobile touch targets and screen breakpoints
├── js/
│   ├── app.js                   # Application bootstrap & lifecycle orchestrator
│   ├── router.js                # Hash-based SPA router with RBAC route guards
│   ├── api.js                   # Central API client with JWT Bearer injection & offline interception
│   ├── auth.js                  # User profile and session management
│   ├── state.js                 # Reactive publish-subscribe application state store
│   ├── validators.js            # High-precision Decimal string validators
│   ├── i18n/
│   │   ├── en.json              # English vernacular translation resources
│   │   ├── hi.json              # Devanagari Hindi translation resources
│   │   └── kn.json              # Kannada translation resources
│   ├── components/
│   │   ├── header.js            # Top bar, connectivity status, lang picker
│   │   ├── badge.js             # State badges (Conservation, Transaction, Karat)
│   │   ├── modal.js             # Accessible modal dialogs
│   │   ├── toast.js             # Floating transient alert messages
│   │   └── stat_card.js         # Gold balance & metric visualizer cards
│   ├── services/
│   │   ├── voice_service.js     # Web Speech API & Vernacular voice parser integration
│   │   ├── ocr_service.js       # Scale photo LCD OCR witness service
│   │   ├── hash_service.js      # Canonical JSON & SHA-256 hash chaining
│   │   ├── export_service.js    # Passbook & order ledger CSV/JSON exports
│   │   └── notification_service.js # Agent prompts & dispute reminder alerts
│   ├── offline/
│   │   ├── db.js                # IndexedDB schema (pending_ops, cached_tx, sync_log)
│   │   ├── queue.js             # UUID idempotency queue & canonical hashing
│   │   ├── sync.js              # Background synchronizer with 409 conflict handling
│   │   ├── connectivity.js      # Online/offline event & heartbeat monitor
│   │   ├── qr.js                # Offline QR handshake codec (matches Python spec)
│   │   └── signing.js           # Web Crypto API ECDSA P-256 digital signatures
│   └── screens/
│       ├── login.js             # User authentication
│       ├── register.js          # Jeweller & karigar account registration
│       ├── dashboard.js         # Role-conditional overview and sync panel
│       ├── orders.js            # Order lists and order creation
│       ├── order_detail.js      # Mass balance conservation audit & tx list
│       ├── issue.js             # Issue raw bullion with Voice & OCR assist
│       ├── return.js            # Return finished article & scrap recovery
│       ├── transaction_detail.js# Cryptographic hash trail & QR handshake
│       ├── confirmation.js      # Dual-custody decision (Confirm/Correct/Dispute)
│       ├── correction.js        # Typo correction request proposal
│       ├── dispute.js           # Physical weight dispute & held escrow calculation
│       ├── evidence.js          # Photo evidence upload (SHA-256) & reweighing
│       ├── passbook.js          # Cumulative fine-gold balance ledger
│       ├── settlement.js        # Final mass balance settlement & dual approvals
│       ├── notifications.js     # System & agent notification timeline
│       └── settings.js          # Language selector & cryptographic key diagnostics
└── assets/
    ├── icons/                   # PWA application icons
    └── images/                  # Static assets
```

## Running the Application
1. Start the FastAPI backend:
   ```powershell
   python -m uvicorn backend.app.main:app --reload --port 8000
   ```
2. Serve the `frontend/` folder using any static web server (or Python http.server):
   ```powershell
   python -m http.server 3000 --directory frontend
   ```
3. Open `http://localhost:3000` in Chrome, Edge, or Safari.

## Key Principles & Guardrails
1. **Never Binary Float**: All weights are handled as Decimal strings (up to 4 decimal places, 0.1 mg accuracy) using `Validators.decimalSubtract` and `Validators.formatWeight4`.
2. **AI Is strictly Assistive**: Spoken voice input and scale photos pre-fill editable draft values. Human operators must explicitly review and submit.
3. **Dual-Custody Invariant**: No transaction is authoritative until mutually confirmed. Disputed weight differences are isolated in escrow and cannot be settled without mutual agreement.
