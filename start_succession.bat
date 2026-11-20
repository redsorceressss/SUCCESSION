@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM SUCCESSION - Safe local launcher (Windows)
REM Starts backend (FastAPI/Uvicorn) and frontend (static server) for local development.
REM SAFETY:
REM   - No destructive database operations (no reset/drop/delete).
REM   - Never touches swarn.db, swarn.db-wal, swarn.db-shm, or uploads/.
REM   - Does not run migrations automatically. Uses existing startup schema creation behavior on the configured DB.
REM   - If DATABASE_URL is not configured, defaults to a separate local dev DB: succession_dev.sqlite3 (NOT swarn.db).

cd /d "%~dp0"
echo.
echo ==========================================================
echo   SUCCESSION - Local Unified Application Launcher
echo ==========================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found in PATH.
  echo         Install Python 3.11+ and required dependencies, then retry.
  echo.
  pause
  exit /b 1
)

REM Detect existing listeners to handle already-running services gracefully
set "BACKEND_RUNNING="
set "FRONTEND_RUNNING="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do set "BACKEND_RUNNING=1"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do set "FRONTEND_RUNNING=1"

if defined BACKEND_RUNNING (
  echo [INFO] Port 8000 is already in use/listening. Backend may already be running.
)
if defined FRONTEND_RUNNING (
  echo [INFO] Port 3000 is already in use/listening. Frontend may already be running.
)
if defined BACKEND_RUNNING if defined FRONTEND_RUNNING (
  echo [INFO] Both services appear to be running. Opening the main app URL...
  start "" "http://localhost:3000/"
  echo.
  pause
  exit /b 0
)

REM Safe database selection (never swarn.db)
if "%DATABASE_URL%"=="" (
  set "DATABASE_URL=sqlite:///./succession_dev.sqlite3"
  echo [INFO] DATABASE_URL not set. Using safe local dev database:
  echo        %DATABASE_URL%
  echo        (This is separate from swarn.db. No existing data will be deleted/reset.)
) else (
  echo [INFO] Using DATABASE_URL from environment.
  echo        Ensure it points to a safe local/disposable database (NOT swarn.db).
)

if "%APP_ENV%"=="" set "APP_ENV=development"
if "%ALLOWED_ORIGINS%"=="" set "ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000"

echo [INFO] APP_ENV=%APP_ENV%
echo [INFO] Backend:  http://127.0.0.1:8000  (health: /health, docs: /docs)
echo [INFO] Frontend: http://localhost:3000/
echo [INFO] Main entry point: http://localhost:3000/
echo.
echo [NOTE] First-time setup requirements:
echo        - Install deps: python -m pip install -r requirements.txt
echo        - Configure .env locally if needed (do not commit secrets/.env)
echo        - On app startup, backend runs existing SQLAlchemy create_all for core tables.
echo          Alembic migrations exist but 0001 is a pass-through baseline; for fresh DBs,
echo          use the existing safe init/startup flow appropriate to this repo state.
echo        - Optional guarded seed/agent scripts require disposable DB + explicit safeguards.
echo.

if not defined BACKEND_RUNNING (
  echo [START] Launching backend server...
  start "SUCCESSION Backend" cmd /k "cd /d \"%~dp0\" && set DATABASE_URL=%DATABASE_URL% && set APP_ENV=%APP_ENV% && set ALLOWED_ORIGINS=%ALLOWED_ORIGINS% && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
) else (
  echo [SKIP] Backend port already in use; not starting a second backend.
)

REM Brief pause to let backend initialize
timeout /t 2 /nobreak >nul

if not defined FRONTEND_RUNNING (
  echo [START] Launching frontend static server...
  start "SUCCESSION Frontend" cmd /k "cd /d \"%~dp0\" && python -m http.server 3000 --directory frontend"
) else (
  echo [SKIP] Frontend port already in use; not starting a second frontend server.
)

REM Give servers a moment, then open main entry point
timeout /t 2 /nobreak >nul
echo [OPEN] Opening http://localhost:3000/
start "" "http://localhost:3000/"

echo.
echo [DONE] Launcher finished dispatching services.
echo        Check the opened backend/frontend windows for startup logs and errors.
echo        To stop: close those windows or stop their processes.
echo.
pause
endlocal
exit /b 0
