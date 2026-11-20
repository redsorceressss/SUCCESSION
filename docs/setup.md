# Setup & Developer Guide (Windows / macOS / Linux)

## Prerequisites
- **Python:** 3.11+ (3.13 used in verified project environments)
- **pip** and **Git**
- **Node.js** (for maintained frontend/JS checks)

## 1. Open the repository root
Run commands from the repository root (the folder containing `README.md`, `backend/`, `frontend/`, and `alembic.ini`).

- Windows (PowerShell): `cd path\to\succession`
- macOS/Linux: `cd path/to/succession`

## 2. (Recommended) Create and activate a virtual environment
### Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
If script execution is blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (CurrentUser) or use `.\.venv\Scripts\python.exe ...`.

### macOS / Linux
```bash
python3 -m venv .venv  # or: python -m venv .venv
source .venv/bin/activate
```

## 3. Install dependencies
```bash
python -m pip install -r requirements.txt
```
This includes Alembic, which is required for database migrations.

## 4. Configure environment variables (local only)
- Windows (PowerShell): `Copy-Item .env.example .env`
- macOS/Linux: `cp .env.example .env`

Edit `.env` locally as needed. **Never commit `.env`, local databases (`*.db`, `*.db-wal`, `*.db-shm`, `*.sqlite*`), `uploads/`, `.tmp*`, or cache artifacts.** Set a strong `SECRET_KEY` for any non-development use and configure `ALLOWED_ORIGINS` appropriately for production.

## 5. Initialize/migrate the database
- **Fresh/disposable database (recommended):** run from repo root:
  ```bash
  python -m alembic upgrade head
  ```
  Alembic config: `alembic.ini` (`script_location = backend/alembic`); the environment resolves the database URL from app settings (`DATABASE_URL`).
- **Existing local databases:** schema/stamp state may vary. Inspect and align carefully; **do not downgrade, reset, or blindly modify existing data**.
- **Note:** `backend/app/main.py` currently calls `Base.metadata.create_all(engine)` on startup (existing behavior). Prefer Alembic-managed migrations for schema evolution/history.

## 6. (Optional) Verify environment
```bash
python scripts/verify_setup.py
```
`scripts/verify_setup.py` exists in this repository and performs environment/import checks; run it against a safe/local configuration.

## 7. (Optional, development/disposable database only) Seed synthetic demo data
`scripts/seed_demo.py` is safe-by-default for public use and **does not** perform destructive resets or schema creation. It requires an already-migrated schema and explicit safeguards.

Set environment variables for the command/process only (do **not** target `swarn.db` or any non-disposable database):
- `DATABASE_URL` = explicit disposable SQLite/database URL
- `ALLOW_DEMO_SEED=1`
- `DEMO_SEED_CONFIRM_DISPOSABLE_DB=YES`
- `DEMO_JEWELLER_PASSWORD`, `DEMO_KARIGAR_PASSWORD`, `DEMO_AGENT_PASSWORD` (or provide via hidden prompt)

Example (Windows PowerShell):
```powershell
$env:DATABASE_URL="sqlite:///C:/path/to/disposable_demo.sqlite3"
$env:ALLOW_DEMO_SEED="1"
$env:DEMO_SEED_CONFIRM_DISPOSABLE_DB="YES"
$env:DEMO_JEWELLER_PASSWORD="<set-securely>"
$env:DEMO_KARIGAR_PASSWORD="<set-securely>"
$env:DEMO_AGENT_PASSWORD="<set-securely>"
python -m scripts.seed_demo
```
Example (macOS/Linux):
```bash
DATABASE_URL="sqlite:////tmp/disposable_demo.sqlite3" \
ALLOW_DEMO_SEED=1 DEMO_SEED_CONFIRM_DISPOSABLE_DB=YES \
DEMO_JEWELLER_PASSWORD="<set-securely>" DEMO_KARIGAR_PASSWORD="<set-securely>" DEMO_AGENT_PASSWORD="<set-securely>" \
python -m scripts.seed_demo
```
The seed script refuses unsafe targets, requires an already-migrated schema, preserves expected synthetic demo entities/relationships, performs a no-op when the expected dataset is already valid, and stops on partial/unexpected state without silent repair.

## 8. Run tests
```bash
python -m pytest -q
```
Maintained frontend/Node checks:
```bash
node tests/test_frontend_hash_vectors.js
node tests/test_frontend_offline_qr.js
node tests/test_frontend_offline_signing.js
node tests/frontend/test_offline_queue_sync_behavior.mjs
node tests/frontend/test_rag_assistant_panel.mjs
node tests/frontend/test_scale_ocr_review.mjs
node tests/frontend/test_voice_draft_review.mjs
```

## 9. Start the backend API
```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```
- Health: `http://127.0.0.1:8000/health`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## 10. Start the frontend (static server)
```bash
python -m http.server 3000 --directory frontend
```
Open `http://localhost:3000`. The frontend API base defaults to `http://127.0.0.1:8000` unless configured by injected config or local storage.

## Advisory agent (optional)
- Single run: `python -m ai_engine.agent.run_once`
- Scheduler: `python -m ai_engine.agent.scheduler`

Provide agent credentials securely (environment variables or hidden prompt). Do not hardcode or commit secrets. The agent account creation script (`python -m scripts.create_agent <login>`) requires an already-migrated database and a securely provided password.
